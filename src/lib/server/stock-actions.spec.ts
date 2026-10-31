import { describe, expect, it } from 'vitest';
import { actionTime } from './stock-actions';

const form = (offlineAt?: string) => {
	const data = new FormData();
	if (offlineAt) data.set('offlineAt', offlineAt);
	return data;
};

describe('actionTime', () => {
	const now = new Date('2026-11-02T10:00:00Z');

	it('keeps the time of an action done offline in the last week', () => {
		const at = new Date('2026-11-01T18:30:00Z');
		expect(actionTime(form(at.toISOString()), now)).toEqual(at);
	});

	it('uses now without a time, or with one in the future, too old or invalid', () => {
		expect(actionTime(form(), now)).toBe(now);
		expect(actionTime(form('2026-11-03T10:00:00Z'), now)).toBe(now);
		expect(actionTime(form('2026-10-01T10:00:00Z'), now)).toBe(now);
		expect(actionTime(form('soon'), now)).toBe(now);
	});
});
