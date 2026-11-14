import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '#lib/server/db.ts';
import { itemCardSelect, toItemCard } from '#lib/server/items.ts';
import { searchItemIds } from '#lib/server/search.ts';
import { canManageStock } from '#lib/roles.ts';

const LIMIT = 120;

/**
 * Pieces a keeper can put into this unit (put in → Search): the gallery search, or with no text
 * the pieces stored nowhere. Pieces already in the unit are left out; pieces on loan too (they
 * come back through "Returns").
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!canManageStock(locals.user?.role)) error(403);
	const text = url.searchParams.get('q')?.trim() ?? '';
	const unstoredOnly = url.searchParams.get('unstored') === '1';

	const where = {
		boxId: unstoredOnly ? null : { not: params.id },
		loans: { none: { returnedAt: null } },
		condition: { not: 'RETIRED' as const }
	};
	if (!text) {
		const items = await prisma.item.findMany({
			where: { ...where, boxId: null },
			select: itemCardSelect,
			orderBy: [{ name: 'asc' }, { size: 'asc' }],
			take: LIMIT
		});
		return json(items.map(toItemCard));
	}
	const { ids } = await searchItemIds(text);
	const items = await prisma.item.findMany({
		where: { ...where, id: { in: ids.slice(0, LIMIT * 2) } },
		select: itemCardSelect
	});
	const rank = new Map(ids.map((id, index) => [id, index]));
	items.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
	return json(items.slice(0, LIMIT).map(toItemCard));
};
