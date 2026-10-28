import type { Actions, PageServerLoad } from './$types';
import { stockActionOptions, stockActions } from '#lib/server/stock-actions.ts';
import { canCheckOut, canCollect, canSetCondition } from '#lib/roles.ts';

export const load: PageServerLoad = async ({ locals }) => ({
	stock:
		canSetCondition(locals.user?.role) ||
		canCheckOut(locals.user?.role) ||
		canCollect(locals.user?.role)
			? await stockActionOptions()
			: null
});

export const actions: Actions = stockActions;
