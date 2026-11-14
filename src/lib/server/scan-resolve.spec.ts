import { describe, expect, it } from 'vitest';
import { resolveScannedCode, type CodeLookups } from './scan-resolve';

const lookups = (codes: { item?: string[]; box?: string[]; container?: string[] }): CodeLookups => {
	const find =
		(list: string[] = []) =>
		async (code: string) =>
			list.includes(code) ? { id: `id-${code}` } : null;
	return { item: find(codes.item), box: find(codes.box), container: find(codes.container) };
};

describe('resolveScannedCode', () => {
	it('opens a unit from its label', async () => {
		expect(await resolveScannedCode('B-ROB1', lookups({ box: ['B-ROB1'] }))).toEqual({
			type: 'box',
			id: 'id-B-ROB1'
		});
	});

	it('keeps old piece links working, checked first', async () => {
		const result = await resolveScannedCode(
			'X7K2PQ',
			lookups({ item: ['X7K2PQ'], box: ['X7K2PQ'] })
		);
		expect(result).toEqual({ type: 'item', id: 'id-X7K2PQ' });
	});

	it('opens the container from its label', async () => {
		expect(await resolveScannedCode('C-AQDNP', lookups({ container: ['C-AQDNP'] }))).toEqual({
			type: 'container',
			id: 'id-C-AQDNP'
		});
	});

	it('returns null for an unknown code', async () => {
		expect(await resolveScannedCode('NOPE', lookups({}))).toBeNull();
	});
});
