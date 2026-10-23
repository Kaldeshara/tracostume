import type { Actions, PageServerLoad } from './$types';
import { stockActionOptions, stockActions } from '#lib/server/stock-actions.ts';
import { canManageStock } from '#lib/roles.ts';

export const load: PageServerLoad = async ({ locals }) => ({
	stock: canManageStock(locals.user?.role) ? await stockActionOptions() : null
});

export const actions: Actions = stockActions;
