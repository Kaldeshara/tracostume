import type { PageServerLoad } from './$types';
import { prisma } from '#lib/server/db.ts';
import { itemCardSelect, toItemCard } from '#lib/server/items.ts';
import { buildItemWhere, readItemFilters, sortByRank } from '#lib/server/item-filters.ts';
import { groupItems } from '#lib/item-groups.ts';

// Cards shown at most; identical pieces share one card.
const MAX_GROUPS = 150;

export const load: PageServerLoad = async ({ url }) => {
	const filters = readItemFilters(url.searchParams);
	const { where, rankedIds, semantic } = await buildItemWhere(filters);

	const [items, total, categories, boxes] = await Promise.all([
		prisma.item.findMany({
			where,
			select: itemCardSelect,
			orderBy: [{ name: 'asc' }, { size: 'asc' }, { code: 'asc' }]
		}),
		prisma.item.count({ where }),
		prisma.item.findMany({
			where: { category: { not: null } },
			distinct: ['category'],
			select: { category: true },
			orderBy: { category: 'asc' }
		}),
		prisma.box.findMany({
			select: { id: true, code: true, label: true },
			orderBy: { label: 'asc' }
		})
	]);

	const groups = groupItems(sortByRank(items, rankedIds).map(toItemCard));
	return {
		filters,
		groups: groups.slice(0, MAX_GROUPS),
		groupTotal: groups.length,
		total,
		semantic,
		categories: categories.map((row) => row.category!),
		boxes
	};
};
