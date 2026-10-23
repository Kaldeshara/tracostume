import { createHash } from 'node:crypto';
import { MODELS_DIR } from '$app/env/private';
import { prisma } from './db';
import { asPassage, asQuery, dot, embed, MODEL_ID } from '#lib/embeddings/model.ts';
import type { Scored } from '#lib/search-rank.ts';

// Keeps one vector per item in the database and in memory, refreshed whenever the item's text
// changes. Everything is small (about a thousand pieces × 384 floats), so similarity is computed
// in memory rather than in Postgres.

type Cached = { hash: string; vector: Float32Array };
const cache = new Map<string, Cached>();
let loaded = false;
let syncing: Promise<void> | null = null;

const hashOf = (text: string) => createHash('sha1').update(MODEL_ID).update(text).digest('hex');

type ItemText = {
	id: string;
	name: string;
	category: string | null;
	color: string | null;
	size: string | null;
	description: string | null;
	tags: { tag: { name: string } }[];
};

export function itemText(item: ItemText) {
	// The import line ("Importé du Drive : …/file.jpg") is bookkeeping, not meaning.
	const description = item.description
		?.split('\n')
		.filter((line) => !line.startsWith('Importé du Drive'))
		.join(' ')
		.trim();
	return [
		item.name,
		[item.category, item.color, item.size].filter(Boolean).join(' '),
		item.tags.map(({ tag }) => tag.name).join(', '),
		description
	]
		.filter(Boolean)
		.join('. ');
}

/** Embeds new or changed items. Cheap when nothing changed. */
export function syncEmbeddings() {
	syncing ??= doSync().finally(() => (syncing = null));
	return syncing;
}

async function doSync() {
	if (!loaded) {
		const rows = await prisma.itemEmbedding.findMany({ where: { model: MODEL_ID } });
		for (const row of rows) {
			cache.set(row.itemId, {
				hash: row.textHash,
				vector: new Float32Array(
					row.vector.buffer,
					row.vector.byteOffset,
					row.vector.byteLength / 4
				)
			});
		}
		loaded = true;
	}

	const items = await prisma.item.findMany({
		select: {
			id: true,
			name: true,
			category: true,
			color: true,
			size: true,
			description: true,
			tags: { select: { tag: { select: { name: true } } } }
		}
	});
	const alive = new Set(items.map((item) => item.id));
	for (const id of cache.keys()) if (!alive.has(id)) cache.delete(id);

	// Identical pieces share one text, so embed each distinct text once.
	const stale = new Map<string, { hash: string; ids: string[] }>();
	for (const item of items) {
		const text = itemText(item);
		const hash = hashOf(text);
		if (cache.get(item.id)?.hash === hash) continue;
		const entry = stale.get(text) ?? { hash, ids: [] };
		entry.ids.push(item.id);
		stale.set(text, entry);
	}
	if (!stale.size) return;

	const texts = [...stale.keys()];
	const vectors = await embed(MODELS_DIR, texts.map(asPassage));
	for (const [index, text] of texts.entries()) {
		const { hash, ids } = stale.get(text)!;
		const vector = vectors[index];
		const bytes = new Uint8Array(vector.byteLength);
		new Float32Array(bytes.buffer).set(vector);
		for (const itemId of ids) {
			await prisma.itemEmbedding.upsert({
				where: { itemId },
				create: { itemId, model: MODEL_ID, textHash: hash, vector: bytes },
				update: { model: MODEL_ID, textHash: hash, vector: bytes }
			});
			cache.set(itemId, { hash, vector });
		}
	}
	console.log(`[search] embedded ${texts.length} texts for ${stale.size} groups of items`);
}

/** Every item scored against the query, best first. */
export async function semanticSearch(query: string): Promise<Scored[]> {
	await syncEmbeddings();
	const [vector] = await embed(MODELS_DIR, [asQuery(query)]);
	const scored: Scored[] = [];
	for (const [id, { vector: other }] of cache) scored.push({ id, score: dot(vector, other) });
	return scored.sort((a, b) => b.score - a.score);
}

/** Loads the model and embeds the catalogue in the background at server start. */
export function warmUpSearch() {
	syncEmbeddings().catch((error) => console.error('[search] warm-up failed', error));
}
