import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { readBoxForm } from '#lib/server/boxes.ts';
import { InventoryError, recordUnitCheck } from '#lib/server/inventory.ts';
import { itemCardSelect, toItemCard } from '#lib/server/items.ts';
import { qrSvg } from '#lib/server/qr.ts';
import {
	actionTime,
	REPAIR_CONDITIONS,
	stockActionOptions,
	stockActions
} from '#lib/server/stock-actions.ts';
import { canCheckOut, canManageStock, canSeeContainer, isRepairer } from '#lib/roles.ts';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const role = locals.user?.role;
	const box = await prisma.box.findUnique({
		where: { id: params.id },
		include: {
			container: { select: { name: true } },
			items: {
				// Repairers only see the pieces that need care (constitution Principle III).
				where: isRepairer(role) ? { condition: { in: REPAIR_CONDITIONS } } : {},
				select: itemCardSelect,
				orderBy: [{ name: 'asc' }, { size: 'asc' }]
			},
			checks: {
				orderBy: { checkedAt: 'desc' },
				take: 1,
				select: {
					checkedAt: true,
					expectedCount: true,
					foundCount: true,
					user: { select: { firstName: true, lastName: true } }
				}
			}
		}
	});
	if (!box) error(404);

	const { items, checks, ...rest } = box;
	const lastCheck = checks[0] ?? null;
	return {
		box: rest,
		pieces: items.map(toItemCard),
		lastCheck: lastCheck && {
			checkedAt: lastCheck.checkedAt,
			expectedCount: lastCheck.expectedCount,
			foundCount: lastCheck.foundCount,
			by: lastCheck.user ? `${lastCheck.user.firstName} ${lastCheck.user.lastName}`.trim() : null
		},
		qr: canSeeContainer(role) ? await qrSvg(url.origin, box.code) : null,
		// Lending and moving from the unit (take out): same options as the piece pages.
		stock: canCheckOut(role) ? await stockActionOptions() : null,
		// Put in → Returns: pieces on loan, for keepers (they come back into a unit).
		lentPieces: canManageStock(role)
			? (
					await prisma.item.findMany({
						where: { loans: { some: { returnedAt: null } } },
						select: itemCardSelect,
						orderBy: [{ name: 'asc' }, { size: 'asc' }]
					})
				).map(toItemCard)
			: []
	};
};

export const actions: Actions = {
	// Take out (lend or move) and put in reuse the stock actions (constitution Principle II).
	...stockActions,

	/** Contents check: keepers confirm what is there; pieces not found become lost. */
	check: async (event) => {
		const user = requireRole(event, 'KEEPER');
		const form = await event.request.formData();
		const ids = (name: string) =>
			[...new Set(form.getAll(name).map(String))].filter(Boolean).slice(0, 2000);
		try {
			const result = await recordUnitCheck(
				event.params.id,
				ids('expectedId'),
				ids('missingId'),
				user.id,
				actionTime(form)
			);
			return { done: 'check' as const, ...result };
		} catch (err) {
			if (err instanceof InventoryError) return fail(404, { error: err.code });
			throw err;
		}
	},

	update: async (event) => {
		requireRole(event, 'KEEPER');
		const { values, parsed } = readBoxForm(await event.request.formData());
		if (!parsed.success) return fail(400, { values, invalid: true });
		await prisma.box.update({ where: { id: event.params.id }, data: parsed.data });
		return { saved: true };
	},

	delete: async (event) => {
		requireRole(event, 'ADMIN');
		const count = await prisma.item.count({ where: { boxId: event.params.id } });
		if (count > 0) return fail(400, { notEmpty: true });
		await prisma.box.delete({ where: { id: event.params.id } });
		redirect(303, '/boxes');
	}
};
