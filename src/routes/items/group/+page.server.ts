import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '#lib/server/db.ts';
import { itemCardSelect, toItemCard } from '#lib/server/items.ts';
import { groupItems } from '#lib/item-groups.ts';
import { isCategory } from '#lib/categories.ts';

// All pieces identical to one another: same name, category and colour (see item-groups.ts).
export const load: PageServerLoad = async ({ url }) => {
	const name = url.searchParams.get('name');
	if (!name) error(404);
	const category = url.searchParams.get('category') ?? '';
	if (!isCategory(category)) error(404);
	const color = url.searchParams.get('color') || null;

	const items = await prisma.item.findMany({
		where: { name, category, color },
		select: itemCardSelect,
		orderBy: [{ size: 'asc' }, { code: 'asc' }]
	});
	if (!items.length) error(404);

	const [group] = groupItems(items.map(toItemCard));
	return { group, items: items.map(toItemCard) };
};
