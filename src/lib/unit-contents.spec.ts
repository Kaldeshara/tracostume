import { describe, expect, it } from 'vitest';
import type { ItemCard } from '#lib/server/items.ts';
import { groupKey } from './item-groups';
import {
	groupUnitContents,
	missingFromCheck,
	pickableOrder,
	pickPieces,
	PickError
} from './unit-contents';

const box = { id: 'b1', code: 'B-1', label: 'Jupes', shelf: null, container: { name: 'C' } };
const loan = {
	id: 'l',
	borrower: 'Léa',
	dueAt: null,
	collectedAt: null,
	contact: null
} as unknown as NonNullable<ItemCard['loan']>;

let counter = 0;
const piece = (overrides: Partial<ItemCard>): ItemCard => {
	counter++;
	return {
		id: `id${counter}`,
		code: `C${String(counter).padStart(3, '0')}`,
		name: 'Jupe flamenco',
		category: 'SKIRT',
		color: 'noire',
		size: null,
		condition: 'GOOD',
		photoId: null,
		box,
		loan: null,
		...overrides
	};
};

describe('pickableOrder', () => {
	it('leaves out pieces on loan, lost or retired', () => {
		const pieces = [
			piece({ code: 'A' }),
			piece({ code: 'B', loan }),
			piece({ code: 'C', condition: 'LOST' }),
			piece({ code: 'D', condition: 'RETIRED' })
		];
		expect(pickableOrder(pieces).map((p) => p.code)).toEqual(['A']);
	});

	it('puts good pieces first, then to wash, then the other repair states', () => {
		const pieces = [
			piece({ code: 'A', condition: 'DAMAGED' }),
			piece({ code: 'B', condition: 'TO_WASH' }),
			piece({ code: 'C', condition: 'GOOD' }),
			piece({ code: 'D', condition: 'TO_REPAIR' }),
			piece({ code: 'E', condition: 'IN_REPAIR' })
		];
		expect(pickableOrder(pieces).map((p) => p.code)).toEqual(['C', 'B', 'D', 'E', 'A']);
	});

	it('breaks ties by code so results are stable', () => {
		const pieces = [piece({ code: 'Z' }), piece({ code: 'M' }), piece({ code: 'A' })];
		expect(pickableOrder(pieces).map((p) => p.code)).toEqual(['A', 'M', 'Z']);
	});
});

describe('groupUnitContents', () => {
	it('groups identical pieces like the gallery, with counts per size', () => {
		const groups = groupUnitContents([
			piece({ size: '38' }),
			piece({ size: '36' }),
			piece({ size: '38' }),
			piece({ name: 'Chapeau', category: 'HAT', color: null, size: '57' })
		]);
		expect(groups.map((g) => [g.name, g.count])).toEqual([
			['Chapeau', 1],
			['Jupe flamenco', 3]
		]);
		const skirts = groups[1];
		expect(skirts.sizes).toEqual([
			{ size: '36', count: 1, available: 1 },
			{ size: '38', count: 2, available: 2 }
		]);
	});

	it('counts what can be taken and the conditions that need care', () => {
		const [group] = groupUnitContents([
			piece({}),
			piece({ condition: 'TO_REPAIR' }),
			piece({ loan }),
			piece({ condition: 'LOST' })
		]);
		expect(group.count).toBe(4);
		expect(group.available).toBe(2);
		expect(group.attention).toEqual({ TO_REPAIR: 1, LOST: 1 });
	});

	it('sorts sizes naturally and keeps pieces without a size apart', () => {
		const [group] = groupUnitContents([
			piece({ size: '40' }),
			piece({ size: '8' }),
			piece({ size: null }),
			piece({ size: 'M' })
		]);
		expect(group.sizes.map((s) => s.size)).toEqual(['8', '40', 'M', '']);
	});

	it('shows the first piece with a photo', () => {
		const [group] = groupUnitContents([piece({}), piece({ photoId: 'p1' })]);
		expect(group.representative.photoId).toBe('p1');
	});
});

describe('pickPieces', () => {
	const skirts = () => [
		piece({ code: 'S1', size: '36' }),
		piece({ code: 'S2', size: '38', condition: 'TO_WASH' }),
		piece({ code: 'S3', size: '38' }),
		piece({ code: 'S4', size: '40', loan }),
		piece({ code: 'S5', size: '40', condition: 'LOST' })
	];
	const key = groupKey(piece({}));
	const codes = (pieces: ItemCard[], ids: string[]) =>
		ids.map((id) => pieces.find((p) => p.id === id)?.code);

	it('takes the requested number from a group, good pieces first', () => {
		const pieces = skirts();
		expect(codes(pieces, pickPieces(pieces, [{ groupKey: key, count: 2 }]))).toEqual(['S1', 'S3']);
	});

	it('takes per size when sizes are given', () => {
		const pieces = skirts();
		const ids = pickPieces(pieces, [{ groupKey: key, sizes: { '38': 2, '36': 1 } }]);
		expect(codes(pieces, ids).sort()).toEqual(['S1', 'S2', 'S3']);
	});

	it('never takes pieces on loan, lost or retired', () => {
		const pieces = skirts();
		expect(() => pickPieces(pieces, [{ groupKey: key, sizes: { '40': 1 } }])).toThrow(PickError);
	});

	it('refuses more than available', () => {
		const pieces = skirts();
		expect(() => pickPieces(pieces, [{ groupKey: key, count: 4 }])).toThrow(PickError);
	});

	it('handles several groups and ignores empty requests', () => {
		const hat = piece({ code: 'H1', name: 'Chapeau', category: 'HAT', color: null });
		const pieces = [...skirts(), hat];
		const ids = pickPieces(pieces, [
			{ groupKey: key, count: 1 },
			{ groupKey: groupKey(hat), count: 1 },
			{ groupKey: key, count: 0 }
		]);
		expect(codes(pieces, ids)).toEqual(['S1', 'H1']);
	});
});

describe('missingFromCheck', () => {
	const pieces = () => [
		piece({ code: 'M1', size: '36' }),
		piece({ code: 'M2', size: '38', condition: 'TO_REPAIR' }),
		piece({ code: 'M3', size: '38' }),
		piece({ code: 'H1', name: 'Chapeau', category: 'HAT', color: null })
	];
	const key = groupKey(piece({}));
	const hatKey = groupKey(piece({ name: 'Chapeau', category: 'HAT', color: null }));
	const codes = (list: ItemCard[], ids: string[]) =>
		ids.map((id) => list.find((p) => p.id === id)?.code).sort();

	it('marks nothing when everything is found', () => {
		const list = pieces();
		expect(
			missingFromCheck(list, [
				{ groupKey: key, count: 3 },
				{ groupKey: hatKey, count: 1 }
			])
		).toEqual([]);
	});

	it('marks the pieces least likely to be there first (end of the take order)', () => {
		const list = pieces();
		const ids = missingFromCheck(list, [
			{ groupKey: key, count: 2 },
			{ groupKey: hatKey, count: 1 }
		]);
		expect(codes(list, ids)).toEqual(['M2']);
	});

	it('respects sizes when they are given', () => {
		const list = pieces();
		const ids = missingFromCheck(list, [
			{ groupKey: key, sizes: { '36': 0, '38': 2 } },
			{ groupKey: hatKey, count: 1 }
		]);
		expect(codes(list, ids)).toEqual(['M1']);
	});

	it('treats a group left out of the answer as all missing', () => {
		const list = pieces();
		expect(codes(list, missingFromCheck(list, [{ groupKey: key, count: 3 }]))).toEqual(['H1']);
	});

	it('rejects finding more than expected', () => {
		expect(() => missingFromCheck(pieces(), [{ groupKey: hatKey, count: 2 }])).toThrow(RangeError);
	});
});
