import type { ItemCard } from '#lib/server/items.ts';

// Identical pieces (same name, category and colour) are shown as one gallery card.

export type ItemGroup = {
	key: string;
	name: string;
	category: string | null;
	color: string | null;
	/** The card shown for the group (first piece with a photo). */
	representative: ItemCard;
	ids: string[];
	count: number;
	inCount: number;
	outCount: number;
	overdueCount: number;
	unstoredCount: number;
	/** Pieces whose condition needs attention (anything but GOOD). */
	attentionCount: number;
	sizes: string[];
	/** Set when every piece is in the same box. */
	sameBox: ItemCard['box'];
};

export const groupKey = (item: Pick<ItemCard, 'name' | 'category' | 'color'>) =>
	[item.name, item.category ?? '', item.color ?? ''].join('\u0000');

export function groupItems(items: ItemCard[], now = Date.now()): ItemGroup[] {
	const groups = new Map<string, ItemGroup>();
	for (const item of items) {
		const key = groupKey(item);
		let group = groups.get(key);
		if (!group) {
			group = {
				key,
				name: item.name,
				category: item.category,
				color: item.color,
				representative: item,
				ids: [],
				count: 0,
				inCount: 0,
				outCount: 0,
				overdueCount: 0,
				unstoredCount: 0,
				attentionCount: 0,
				sizes: [],
				sameBox: item.box
			};
			groups.set(key, group);
		}
		if (!group.representative.photoId && item.photoId) group.representative = item;
		group.ids.push(item.id);
		group.count++;
		if (item.loan) {
			group.outCount++;
			if (item.loan.dueAt && new Date(item.loan.dueAt).getTime() < now) group.overdueCount++;
		} else if (item.box) {
			group.inCount++;
		} else {
			group.unstoredCount++;
		}
		if (item.condition !== 'GOOD') group.attentionCount++;
		if (item.size && !group.sizes.includes(item.size)) group.sizes.push(item.size);
		if (group.sameBox && group.sameBox.id !== item.box?.id) group.sameBox = null;
	}
	return [...groups.values()];
}
