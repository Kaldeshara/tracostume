import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

// Compares embedding models on the real catalogue with a few natural-language queries and the
// pieces they should find. Prints, per query, the best matches and where the expected ones rank.
//
//   npx tsx scripts/search-eval.ts                      # default model
//   MODEL=Xenova/multilingual-e5-base DTYPE=q8 npx tsx scripts/search-eval.ts

const MODEL = process.env.MODEL || 'Xenova/multilingual-e5-small';
const DTYPE = (process.env.DTYPE || 'q8') as 'q8' | 'fp32';
const E5 = /e5/.test(MODEL);
const cacheDir = process.env.MODELS_DIR?.trim() || './data/models';

// Expected answers are name fragments; a query is satisfied when they appear near the top.
const QUERIES: [string, string[]][] = [
	['quelque chose de brillant pour un numéro années 20', ['charleston', 'sequin', 'paillettes']],
	['tenue de pirate', ['pirate']],
	['déguisement pour un spectacle sur la jungle', ['tigre', 'zèbre', 'girafe']],
	['vêtement blanc pour homme élégant', ['Chemise blanche', 'Costume', 'Pantalon blanc']],
	['quelque chose de chaud pour un tableau hiver', ['Manteau', 'Pull', 'Cape', 'Imper']],
	['robe des années 50', ['Robe']],
	['tenue de soldat romain', ['romain']],
	['chapeau de magicien', ['Haut de forme']],
	['something sparkly and red', ['rouge', 'paillettes']]
];

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

async function main() {
	const { pipeline, env } = await import('@huggingface/transformers');
	env.cacheDir = cacheDir;
	const t0 = Date.now();
	const extractor = await pipeline('feature-extraction', MODEL, { dtype: DTYPE });
	console.log(`${MODEL} (${DTYPE}) loaded in ${Date.now() - t0} ms`);

	const items = await prisma.item.findMany({
		select: { name: true, category: true, color: true },
		distinct: ['name', 'category', 'color']
	});
	const texts = items.map((i) =>
		[i.name, [i.category, i.color].filter(Boolean).join(' ')].filter(Boolean).join('. ')
	);

	const embed = async (list: string[]) => {
		const out: number[][] = [];
		for (let s = 0; s < list.length; s += 16) {
			const r = await extractor(list.slice(s, s + 16), { pooling: 'mean', normalize: true });
			out.push(...(r.tolist() as number[][]));
		}
		return out;
	};
	const t1 = Date.now();
	const vectors = await embed(texts.map((t) => (E5 ? `passage: ${t}` : t)));
	console.log(
		`${texts.length} texts embedded in ${Date.now() - t1} ms, rss ${Math.round(process.memoryUsage().rss / 1e6)} MB`
	);

	let totalScore = 0;
	for (const [query, expected] of QUERIES) {
		const [q] = await embed([E5 ? `query: ${query}` : query]);
		const scored = vectors
			.map((v, i) => ({ name: items[i].name, score: v.reduce((s, x, k) => s + x * q[k], 0) }))
			.sort((a, b) => b.score - a.score);
		const ranks = expected.map(
			(e) => scored.findIndex((s) => s.name.toLowerCase().includes(e.toLowerCase())) + 1
		);
		// Query score: best expected rank, as reciprocal rank (1 = top result).
		const best = Math.min(...ranks.filter((r) => r > 0));
		totalScore += best ? 1 / best : 0;
		console.log(`\n"${query}"  expected ranks: ${ranks.join(', ')}`);
		for (const { name, score } of scored.slice(0, 5)) console.log(`  ${score.toFixed(3)}  ${name}`);
	}
	console.log(`\nSCORE ${(totalScore / QUERIES.length).toFixed(3)}  (${MODEL} ${DTYPE})`);
}
main().finally(() => prisma.$disconnect());
