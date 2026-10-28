import type { Actions, PageServerLoad } from './$types';
import { prisma } from '#lib/server/db.ts';
import { itemCardSelect, toItemCard } from '#lib/server/items.ts';
import { stockActionOptions, stockActions } from '#lib/server/stock-actions.ts';
import { canCheckOut, canCollect, canSetCondition } from '#lib/roles.ts';

// The selection lives in the browser; the page passes it as ?ids=… to get the locations.
export const load: PageServerLoad = async ({ url, locals }) => {
	const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, 500);
	const items = ids.length
		? await prisma.item.findMany({
				where: { id: { in: ids } },
				select: {
					...itemCardSelect,
					box: {
						select: {
							...itemCardSelect.box.select,
							container: { select: { id: true, name: true } }
						}
					}
				},
				orderBy: [{ name: 'asc' }, { code: 'asc' }]
			})
		: [];

	return {
		items: items.map(toItemCard),
		stock:
			canSetCondition(locals.user?.role) ||
			canCheckOut(locals.user?.role) ||
			canCollect(locals.user?.role)
				? await stockActionOptions()
				: null
	};
};

export const actions: Actions = stockActions;
