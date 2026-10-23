// Text embeddings with a small multilingual model running on the server's CPU
// (no API, no cost). Loaded on first use; the model files are cached in MODELS_DIR.

export const MODEL_ID = 'Xenova/multilingual-e5-small';
export const DIMENSIONS = 384;

type Extractor = (
	texts: string[],
	options: { pooling: 'mean'; normalize: boolean }
) => Promise<{ tolist(): number[][] }>;

let loading: Promise<Extractor> | null = null;

export function loadModel(cacheDir: string): Promise<Extractor> {
	loading ??= (async () => {
		const { pipeline, env } = await import('@huggingface/transformers');
		env.cacheDir = cacheDir;
		const extractor = await pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' });
		return extractor as unknown as Extractor;
	})();
	return loading;
}

// e5 models expect these prefixes; they tell the model which side of the search a text is on.
export const asQuery = (text: string) => `query: ${text}`;
export const asPassage = (text: string) => `passage: ${text}`;

export async function embed(cacheDir: string, texts: string[]): Promise<Float32Array[]> {
	if (!texts.length) return [];
	const extractor = await loadModel(cacheDir);
	const vectors: Float32Array[] = [];
	// Small batches keep memory flat on a modest server.
	for (let start = 0; start < texts.length; start += 16) {
		const output = await extractor(texts.slice(start, start + 16), {
			pooling: 'mean',
			normalize: true
		});
		for (const row of output.tolist()) vectors.push(Float32Array.from(row));
	}
	return vectors;
}

/** Cosine similarity of two normalized vectors. */
export function dot(a: Float32Array, b: Float32Array) {
	let sum = 0;
	for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
	return sum;
}
