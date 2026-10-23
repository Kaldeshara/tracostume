import { fail, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import type { ItemCondition } from '../../generated/prisma/enums';
import { CONDITIONS } from '#lib/format.ts';
import { requireRole } from './auth';
import { prisma } from './db';
import { checkOutItems, InventoryError, placeItems, setItemsCondition } from './inventory';

// Form actions shared by every page that can act on items (item page, selection page).
// Each form posts one or more `itemId` fields.

const checkoutSchema = z.object({
	borrowerUserId: z.string().trim().max(50).optional(),
	borrowerName: z.string().trim().max(200).optional(),
	borrowerPhone: z.string().trim().max(40).optional(),
	reason: z.string().trim().max(500).optional(),
	dueAt: z
		.string()
		.optional()
		.transform((value) => {
			if (!value) return null;
			// Due at the end of the chosen day.
			const date = new Date(`${value}T23:59:59`);
			return Number.isNaN(date.getTime()) ? null : date;
		})
});

const itemIdsOf = (form: FormData) =>
	[...new Set(form.getAll('itemId').map(String))].filter(Boolean).slice(0, 500);

function inventoryFailure(err: unknown) {
	if (err instanceof InventoryError) {
		return fail(400, { error: err.code, codes: err.itemCodes });
	}
	throw err;
}

export const stockActions = {
	place: async (event: RequestEvent) => {
		const user = requireRole(event, 'KEEPER');
		const form = await event.request.formData();
		const itemIds = itemIdsOf(form);
		const boxId = String(form.get('boxId') ?? '');
		if (!itemIds.length || !boxId)
			return fail(400, { error: 'MISSING_FIELDS' as const, codes: [] });
		try {
			const count = await placeItems(
				itemIds,
				boxId,
				user.id,
				String(form.get('note') ?? '') || undefined
			);
			return { done: 'place' as const, count };
		} catch (err) {
			return inventoryFailure(err);
		}
	},

	checkout: async (event: RequestEvent) => {
		const user = requireRole(event, 'KEEPER');
		const form = await event.request.formData();
		const itemIds = itemIdsOf(form);
		const parsed = checkoutSchema.safeParse(Object.fromEntries(form));
		if (!itemIds.length || !parsed.success) {
			return fail(400, { error: 'MISSING_FIELDS' as const, codes: [] });
		}
		const { borrowerUserId, borrowerName, borrowerPhone, reason, dueAt } = parsed.data;
		const borrowerUser = borrowerUserId
			? await prisma.user.findUnique({ where: { id: borrowerUserId }, select: { id: true } })
			: null;
		try {
			const count = await checkOutItems(
				itemIds,
				{
					userId: borrowerUser?.id,
					name: borrowerUser ? null : borrowerName,
					phone: borrowerPhone
				},
				{ dueAt, reason },
				user.id
			);
			return { done: 'checkout' as const, count };
		} catch (err) {
			return inventoryFailure(err);
		}
	},

	condition: async (event: RequestEvent) => {
		const user = requireRole(event, 'KEEPER');
		const form = await event.request.formData();
		const itemIds = itemIdsOf(form);
		const condition = String(form.get('condition') ?? '') as ItemCondition;
		if (!itemIds.length || !CONDITIONS.includes(condition)) {
			return fail(400, { error: 'MISSING_FIELDS' as const, codes: [] });
		}
		const count = await setItemsCondition(
			itemIds,
			condition,
			user.id,
			String(form.get('note') ?? '') || undefined
		);
		return { done: 'condition' as const, count };
	}
};

/** Data the StockActions component needs. */
export async function stockActionOptions() {
	const [boxes, users] = await Promise.all([
		prisma.box.findMany({
			select: { id: true, code: true, label: true, shelf: true },
			orderBy: { label: 'asc' }
		}),
		prisma.user.findMany({
			select: { id: true, firstName: true, lastName: true },
			orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
		})
	]);
	return { boxes, users };
}
