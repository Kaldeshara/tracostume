import type { Prisma } from '../../generated/prisma/client';
import type { ItemCategory, ItemCondition } from '../../generated/prisma/enums';
import { isCategory } from '#lib/categories.ts';
import { CONDITIONS } from '#lib/format.ts';
import { searchItemIds } from './search';

export const STATUSES = ['in', 'out', 'overdue', 'unstored'] as const;
export type Status = (typeof STATUSES)[number];

export type ItemFilters = {
	q: string;
	category: ItemCategory | '';
	condition: ItemCondition | '';
	status: Status | '';
	box: string;
};

export function readItemFilters(params: URLSearchParams): ItemFilters {
	const condition = params.get('condition') ?? '';
	const status = params.get('status') ?? '';
	return {
		q: params.get('q')?.trim() ?? '',
		category: isCategory(params.get('category') ?? '')
			? (params.get('category') as ItemCategory)
			: '',
		condition: (CONDITIONS as string[]).includes(condition) ? (condition as ItemCondition) : '',
		status: (STATUSES as readonly string[]).includes(status) ? (status as Status) : '',
		box: params.get('box') ?? ''
	};
}

/** Builds the Prisma filter and, for a text search, the relevance order of the ids. */
export async function buildItemWhere(filters: ItemFilters) {
	const and: Prisma.ItemWhereInput[] = [];
	let rankedIds: string[] | null = null;
	let semantic = false;

	if (filters.q) {
		({ ids: rankedIds, semantic } = await searchItemIds(filters.q));
		and.push({ id: { in: rankedIds } });
	}
	if (filters.category) and.push({ category: filters.category });
	if (filters.condition) and.push({ condition: filters.condition });
	if (filters.box) and.push({ boxId: filters.box });

	const openLoan = { some: { returnedAt: null } };
	switch (filters.status) {
		case 'in':
			and.push({ boxId: { not: null } });
			break;
		case 'out':
			and.push({ loans: openLoan });
			break;
		case 'overdue':
			and.push({ loans: { some: { returnedAt: null, dueAt: { lt: new Date() } } } });
			break;
		case 'unstored':
			and.push({ boxId: null, loans: { none: { returnedAt: null } } });
			break;
	}

	return { where: { AND: and } satisfies Prisma.ItemWhereInput, rankedIds, semantic };
}

export function sortByRank<T extends { id: string }>(items: T[], rankedIds: string[] | null) {
	if (!rankedIds) return items;
	const rank = new Map(rankedIds.map((id, index) => [id, index]));
	return [...items].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}
