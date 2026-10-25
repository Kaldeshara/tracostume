import { Prisma } from '../../generated/prisma/client';
import { prisma } from './db';
import { semanticSearch } from './embeddings';
import { rankResults } from '#lib/search-rank.ts';
import { CATEGORIES, categorySearchText } from '#lib/categories.ts';

// Category labels in both languages, so "skirt" and "jupe" both match the enum value.
const categoryTextSql = Prisma.sql`CASE i.category ${Prisma.join(
	CATEGORIES.map(
		(category) => Prisma.sql`WHEN ${category}::"ItemCategory" THEN ${categorySearchText(category)}`
	),
	' '
)} END`;

// Full-text search over items, accent-insensitive and with French stemming, so that
// "jupes rouges" finds "Jupe rouge à volants". Every word must match, and each word
// also matches as a prefix ("flam" finds "flamenco"). Item counts are small enough
// that the documents are built on the fly instead of being indexed.

export function toTsQuery(text: string) {
	const terms = text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		// Single letters ("à", "d'") would match almost every word as a prefix.
		.filter((term) => term.length > 1)
		.slice(0, 10);
	return terms.map((term) => `${term}:*`).join(' & ');
}

/**
 * Item ids for a search, best first: pieces close in meaning to the query (semantic search),
 * with those that also contain the typed words on top. Falls back to keywords alone if the
 * model is unavailable.
 */
export async function searchItemIds(text: string): Promise<{ ids: string[]; semantic: boolean }> {
	const keywordIds = await keywordSearchIds(text);
	try {
		return { ids: rankResults(keywordIds, await semanticSearch(text)), semantic: true };
	} catch (error) {
		console.error('[search] semantic search failed, using keywords only', error);
		return { ids: keywordIds, semantic: false };
	}
}

/** Ids of items containing every typed word, best match first. */
export async function keywordSearchIds(text: string): Promise<string[]> {
	const query = toTsQuery(text);
	if (!query) return [];

	const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
		SELECT i.id
		FROM "Item" i
		LEFT JOIN "Box" b ON b.id = i."boxId"
		CROSS JOIN LATERAL (
			SELECT to_tsvector('french', unaccent(concat_ws(' ',
				i.code, i.name, i.description, ${categoryTextSql}, i.color, i.size, b.label, b.code, b.shelf,
				(SELECT string_agg(t.name, ' ') FROM "ItemTag" it JOIN "Tag" t ON t.id = it."tagId" WHERE it."itemId" = i.id)
			))) AS doc
		) d
		CROSS JOIN to_tsquery('french', ${query}) q
		WHERE d.doc @@ q
		ORDER BY ts_rank(d.doc, q) DESC, i.name ASC
		LIMIT 500
	`);
	return rows.map((row) => row.id);
}
