import { describe, expect, it } from 'vitest';
import { toTsQuery } from './search';

describe('toTsQuery', () => {
	it('removes accents and makes every word a prefix', () => {
		expect(toTsQuery('Jupe  ROUGE à volants')).toBe('jupe:* & rouge:* & volants:*');
	});

	it('drops tsquery operators', () => {
		expect(toTsQuery("robe | (bleue) & !courte'")).toBe('robe:* & bleue:* & courte:*');
	});

	it('returns an empty query for blank input', () => {
		expect(toTsQuery('  -- ')).toBe('');
	});
});
