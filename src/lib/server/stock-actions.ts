import { fail, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import type { ItemCondition } from '../../generated/prisma/enums';
import { CONDITIONS } from '#lib/format.ts';
import { requireCapability, requireRole } from './auth';
import { canCheckOut, canCollect, canSetCondition, isRepairer } from '#lib/roles.ts';
import { prisma } from './db';
import {
	checkOutItems,
	collectItems,
	InventoryError,
	placeItems,
	setItemsCondition
} from './inventory';

// Form actions shared by every page that can act on items (item page, selection page).
// Each form posts one or more `itemId` fields.

const checkoutSchema = z.object({
	borrowerUserId: z.string().trim().max(50).optional(),
	contactUserId: z.string().trim().max(50).optional(),
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

/** States a repairer may set. */
export const REPAIRER_CONDITIONS: ItemCondition[] = [
	'GOOD',
	'TO_WASH',
	'TO_REPAIR',
	'IN_REPAIR',
	'DAMAGED'
];
/** Pieces a repairer sees. */
export const REPAIR_CONDITIONS: ItemCondition[] = ['TO_WASH', 'TO_REPAIR', 'IN_REPAIR', 'DAMAGED'];

const OFFLINE_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

/**
 * When the action was done: actions recorded offline by the scanner are sent later with the time
 * they were done (`offlineAt`), kept if it is within the last week.
 */
export function actionTime(form: FormData, now = new Date()) {
	const value = form.get('offlineAt');
	const at = typeof value === 'string' && value ? new Date(value) : null;
	if (!at || Number.isNaN(at.getTime())) return now;
	if (at > now || now.getTime() - at.getTime() > OFFLINE_MAX_AGE_MS) return now;
	return at;
}

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
				String(form.get('note') ?? '') || undefined,
				actionTime(form)
			);
			return { done: 'place' as const, count };
		} catch (err) {
			return inventoryFailure(err);
		}
	},

	checkout: async (event: RequestEvent) => {
		const user = requireCapability(event, canCheckOut);
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
		// A choreographer lending pieces is their contact; keepers may name one.
		const contactUserId =
			user.role === 'CHOREOGRAPHER'
				? user.id
				: parsed.data.contactUserId
					? (
							await prisma.user.findUnique({
								where: { id: parsed.data.contactUserId },
								select: { id: true }
							})
						)?.id
					: null;
		try {
			const count = await checkOutItems(
				itemIds,
				{
					userId: borrowerUser?.id,
					name: borrowerUser ? null : borrowerName,
					phone: borrowerPhone
				},
				{ dueAt, reason, contactUserId },
				user.id,
				actionTime(form)
			);
			return { done: 'checkout' as const, count };
		} catch (err) {
			return inventoryFailure(err);
		}
	},

	collect: async (event: RequestEvent) => {
		const user = requireCapability(event, canCollect);
		const form = await event.request.formData();
		const itemIds = itemIdsOf(form);
		if (!itemIds.length) return fail(400, { error: 'MISSING_FIELDS' as const, codes: [] });
		const count = await collectItems(
			itemIds,
			user.id,
			String(form.get('note') ?? '') || undefined,
			actionTime(form)
		);
		return { done: 'collect' as const, count };
	},

	condition: async (event: RequestEvent) => {
		const user = requireCapability(event, canSetCondition);
		const form = await event.request.formData();
		const itemIds = itemIdsOf(form);
		const condition = String(form.get('condition') ?? '') as ItemCondition;
		if (!itemIds.length || !CONDITIONS.includes(condition)) {
			return fail(400, { error: 'MISSING_FIELDS' as const, codes: [] });
		}
		// Repairers only move pieces between the repair states and back to good.
		if (isRepairer(user.role) && !REPAIRER_CONDITIONS.includes(condition)) {
			return fail(403, { error: 'MISSING_FIELDS' as const, codes: [] });
		}
		const count = await setItemsCondition(
			itemIds,
			condition,
			user.id,
			String(form.get('note') ?? '') || undefined,
			actionTime(form)
		);
		return { done: 'condition' as const, count };
	}
};

/** Data the StockActions component needs. */
export async function stockActionOptions() {
	const [boxes, users, contacts] = await Promise.all([
		prisma.box.findMany({
			select: { id: true, code: true, label: true, shelf: true },
			orderBy: { label: 'asc' }
		}),
		prisma.user.findMany({
			select: { id: true, firstName: true, lastName: true },
			orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
		}),
		prisma.user.findMany({
			where: { role: 'CHOREOGRAPHER' },
			select: { id: true, firstName: true, lastName: true },
			orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
		})
	]);
	return { boxes, users, contacts };
}
