// Merges keyword matches and semantic similarities into one ranking: pieces containing the
// typed words come first (closest meaning first among them), then pieces close in meaning.

export type Scored = { id: string; score: number };

/** Semantic results further than this below the best one are left out. */
export const SEMANTIC_MARGIN = 0.06;
export const MAX_RESULTS = 400;

export function rankResults(keywordIds: string[], semantic: Scored[]): string[] {
	if (!semantic.length) return keywordIds.slice(0, MAX_RESULTS);

	const keywordRank = new Map(keywordIds.map((id, index) => [id, index]));
	const similarity = new Map(semantic.map(({ id, score }) => [id, score]));
	const threshold = semantic[0].score - SEMANTIC_MARGIN;

	const keywordFirst = [...keywordIds].sort(
		(a, b) =>
			(similarity.get(b) ?? 0) - (similarity.get(a) ?? 0) ||
			keywordRank.get(a)! - keywordRank.get(b)!
	);
	const rest = semantic
		.filter(({ id, score }) => score >= threshold && !keywordRank.has(id))
		.map(({ id }) => id);

	return [...keywordFirst, ...rest].slice(0, MAX_RESULTS);
}
