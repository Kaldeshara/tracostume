import type { ItemCard } from '#lib/server/items.ts';
import type { ItemCategory, ItemCondition } from '../generated/prisma/enums';
import { groupKey } from './item-groups';

// What a storage unit holds, grouped like the gallery (same name, category and colour), and
// the rules for choosing which pieces to take from a group. Pure: runs on the server and in the
// browser (the scanner works offline).

export type SizeCount = {
	/** "" for pieces without a size. */
	size: string;
	count: number;
	/** Pieces of this size that can be taken (in the unit, not lent, not lost or retired). */
	available: number;
};

export type UnitGroup = {
	key: string;
	name: string;
	category: ItemCategory;
	color: string | null;
	/** The piece shown for the group (first one with a photo). */
	representative: ItemCard;
	/** Every piece of the group, in the order they would be taken. */
	pieces: ItemCard[];
	count: number;
	available: number;
	sizes: SizeCount[];
	/** Pieces per condition other than GOOD. */
	attention: Partial<Record<ItemCondition, number>>;
};

const NEVER_TAKEN: ItemCondition[] = ['LOST', 'RETIRED'];

/** Good pieces first, then to wash, then the other repair states; never lost or retired. */
const CONDITION_RANK: Partial<Record<ItemCondition, number>> = {
	GOOD: 0,
	TO_WASH: 1,
	TO_REPAIR: 2,
	IN_REPAIR: 3,
	DAMAGED: 4
};

const rank = (piece: ItemCard) => CONDITION_RANK[piece.condition] ?? 9;

export const isPickable = (piece: ItemCard) =>
	!piece.loan && !NEVER_TAKEN.includes(piece.condition);

const byPickOrder = (a: ItemCard, b: ItemCard) => rank(a) - rank(b) || a.code.localeCompare(b.code);

/** The pieces that can be taken, in the order they are taken. */
export function pickableOrder(pieces: ItemCard[]): ItemCard[] {
	return pieces.filter(isPickable).sort(byPickOrder);
}

const naturalOrder = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

/** Sizes sorted naturally (8 before 40), pieces without a size last. */
function compareSizes(a: string, b: string) {
	if (!a || !b) return a ? -1 : b ? 1 : 0;
	return naturalOrder.compare(a, b);
}

export function groupUnitContents(pieces: ItemCard[]): UnitGroup[] {
	const groups = new Map<string, UnitGroup>();
	for (const piece of pieces) {
		const key = groupKey(piece);
		let group = groups.get(key);
		if (!group) {
			group = {
				key,
				name: piece.name,
				category: piece.category,
				color: piece.color,
				representative: piece,
				pieces: [],
				count: 0,
				available: 0,
				sizes: [],
				attention: {}
			};
			groups.set(key, group);
		}
		if (!group.representative.photoId && piece.photoId) group.representative = piece;
		group.pieces.push(piece);
		group.count++;
		const pickable = isPickable(piece);
		if (pickable) group.available++;
		const size = piece.size ?? '';
		let sizeCount = group.sizes.find((entry) => entry.size === size);
		if (!sizeCount) group.sizes.push((sizeCount = { size, count: 0, available: 0 }));
		sizeCount.count++;
		if (pickable) sizeCount.available++;
		if (piece.condition !== 'GOOD')
			group.attention[piece.condition] = (group.attention[piece.condition] ?? 0) + 1;
	}
	for (const group of groups.values()) {
		group.sizes.sort((a, b) => compareSizes(a.size, b.size));
		group.pieces.sort((a, b) => Number(isPickable(b)) - Number(isPickable(a)) || byPickOrder(a, b));
	}
	return [...groups.values()].sort((a, b) => naturalOrder.compare(a.name, b.name));
}

/** What to take from one group: a count, or counts per size ("" for pieces without a size). */
export type PickRequest = { groupKey: string; count?: number; sizes?: Record<string, number> };

/** A request asks for more pieces than can be taken (lent, lost, retired or not there). */
export class PickError extends Error {
	constructor(
		readonly groupKey: string,
		readonly size: string | null
	) {
		super(`Not enough pieces to take in ${groupKey}${size === null ? '' : ` (size ${size})`}`);
	}
}

/** The IDs of the pieces to take, following `pickableOrder`. */
export function pickPieces(pieces: ItemCard[], requests: PickRequest[]): string[] {
	const taken = new Set<string>();
	const take = (
		candidates: ItemCard[],
		count: number,
		request: PickRequest,
		size: string | null
	) => {
		const chosen = candidates.filter((piece) => !taken.has(piece.id)).slice(0, count);
		if (chosen.length < count) throw new PickError(request.groupKey, size);
		for (const piece of chosen) taken.add(piece.id);
	};
	for (const request of requests) {
		const candidates = pickableOrder(
			pieces.filter((piece) => groupKey(piece) === request.groupKey)
		);
		for (const [size, count] of Object.entries(request.sizes ?? {}))
			if (count > 0)
				take(
					candidates.filter((piece) => (piece.size ?? '') === size),
					count,
					request,
					size
				);
		if (request.count) take(candidates, request.count, request, null);
	}
	return [...taken];
}

/** Pieces found during a check, per group: a count, or counts per size. */
export type FoundCount = { groupKey: string; count?: number; sizes?: Record<string, number> };

/**
 * The pieces a contents check marks missing: in each group (or size), the pieces beyond the
 * found count, taken from the end of the take order (pieces needing care first, since they are
 * the likeliest to have left). A group missing from `found` counts as nothing found.
 */
export function missingFromCheck(pieces: ItemCard[], found: FoundCount[]): string[] {
	const missing: string[] = [];
	const lastFirst = (list: ItemCard[]) =>
		[...list].sort((a, b) => Number(isPickable(a)) - Number(isPickable(b)) || byPickOrder(b, a));
	const markBeyond = (list: ItemCard[], count: number) => {
		if (count > list.length) throw new RangeError('Found more pieces than expected');
		missing.push(
			...lastFirst(list)
				.slice(0, list.length - count)
				.map((piece) => piece.id)
		);
	};
	for (const group of groupUnitContents(pieces)) {
		const answer = found.find((entry) => entry.groupKey === group.key);
		if (answer?.sizes) {
			for (const size of group.sizes)
				markBeyond(
					group.pieces.filter((piece) => (piece.size ?? '') === size.size),
					answer.sizes[size.size] ?? 0
				);
		} else {
			markBeyond(group.pieces, answer?.count ?? 0);
		}
	}
	return missing;
}
