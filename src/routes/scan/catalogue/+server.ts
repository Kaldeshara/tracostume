import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '#lib/server/db.ts';
import { itemCardSelect, toItemCard } from '#lib/server/items.ts';
import { REPAIR_CONDITIONS } from '#lib/server/stock-actions.ts';
import { canCheckOut, canCollect, canSetCondition, isRepairer } from '#lib/roles.ts';

/**
 * Every piece and box, kept by the scanner on the phone so that scans still resolve without a
 * connection (inside the container). Only for members who act on pieces.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const role = locals.user?.role;
	if (!(canSetCondition(role) || canCheckOut(role) || canCollect(role))) error(403);

	const [items, boxes] = await Promise.all([
		prisma.item.findMany({
			where: isRepairer(role) ? { condition: { in: REPAIR_CONDITIONS } } : {},
			select: itemCardSelect
		}),
		prisma.box.findMany({
			select: { id: true, code: true, label: true, shelf: true, _count: { select: { items: true } } }
		})
	]);
	return json({ items: items.map(toItemCard), boxes, savedAt: new Date().toISOString() });
};
