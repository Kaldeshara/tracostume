import { describe, expect, it } from 'vitest';
import { rankResults, SEMANTIC_MARGIN } from './search-rank';

describe('rankResults', () => {
	it('keeps keyword order when there is no semantic result', () => {
		expect(rankResults(['b', 'a'], [])).toEqual(['b', 'a']);
	});

	it('cuts semantic results below the margin and boosts keyword matches', () => {
		const semantic = [
			{ id: 'best', score: 0.9 },
			{ id: 'close', score: 0.9 - SEMANTIC_MARGIN / 2 },
			{ id: 'far', score: 0.9 - SEMANTIC_MARGIN * 2 },
			{ id: 'far-but-keyword', score: 0.5 }
		];
		expect(rankResults(['far-but-keyword'], semantic)).toEqual([
			'far-but-keyword',
			'best',
			'close'
		]);
	});

	it('orders keyword matches by semantic closeness', () => {
		const semantic = [
			{ id: 'x', score: 0.85 },
			{ id: 'y', score: 0.86 }
		];
		expect(rankResults(['x', 'y'], semantic)).toEqual(['y', 'x']);
	});
});
