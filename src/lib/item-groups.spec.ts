import { describe, expect, it } from 'vitest';
import type { ItemCard } from '#lib/server/items.ts';
import { groupItems } from './item-groups';

const box = { id: 'b1', code: 'B-1', label: 'Jupes', shelf: null, container: { name: 'C' } };
const piece = (overrides: Partial<ItemCard>): ItemCard => ({
	id: Math.random().toString(36).slice(2),
	code: 'X',
	name: 'Jupe rose',
	category: 'Jupe',
	color: 'rose',
	size: null,
	condition: 'GOOD',
	photoId: null,
	box,
	loan: null,
	...overrides
});

describe('groupItems', () => {
	it('groups by name, category and colour and sums locations', () => {
		const groups = groupItems(
			[
				piece({ size: '36', photoId: 'p' }),
				piece({
					size: '38',
					box: null,
					loan: { id: 'l', borrower: 'Léa', dueAt: new Date(0), checkedOutAt: new Date(0) }
				}),
				piece({ box: null, condition: 'TO_REPAIR' }),
				piece({ name: 'Jupe rose', color: 'rouge' })
			],
			1000
		);
		expect(groups).toHaveLength(2);
		const [rose] = groups;
		expect(rose).toMatchObject({
			count: 3,
			inCount: 1,
			outCount: 1,
			overdueCount: 1,
			unstoredCount: 1,
			attentionCount: 1,
			sizes: ['36', '38'],
			sameBox: null
		});
		expect(rose.representative.photoId).toBe('p');
	});

	it('keeps the box when every piece is in it', () => {
		expect(groupItems([piece({}), piece({})])[0].sameBox?.id).toBe('b1');
	});
});
