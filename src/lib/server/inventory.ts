import type { ItemCondition } from '../../generated/prisma/enums';
import { prisma } from './db';

// Every change to an item's location or condition goes through these functions so that
// the Movement history stays complete.

export class InventoryError extends Error {
	constructor(
		public code: 'ITEMS_ALREADY_OUT' | 'BOX_NOT_FOUND' | 'NO_BORROWER',
		public itemCodes: string[] = []
	) {
		super(code);
	}
}

export type Borrower = {
	userId?: string | null;
	name?: string | null;
	phone?: string | null;
};

/**
 * Puts items into a box. Items that were lent are returned (their loan is closed),
 * items already in another box are moved, and items not stored yet are stored.
 */
export async function placeItems(itemIds: string[], boxId: string, userId: string, note?: string) {
	return prisma.$transaction(async (tx) => {
		const box = await tx.box.findUnique({ where: { id: boxId }, select: { id: true } });
		if (!box) throw new InventoryError('BOX_NOT_FOUND');

		const items = await tx.item.findMany({
			where: { id: { in: itemIds } },
			select: {
				id: true,
				boxId: true,
				loans: { where: { returnedAt: null }, select: { id: true } }
			}
		});
		const now = new Date();

		for (const item of items) {
			const openLoan = item.loans[0];
			if (openLoan) {
				await tx.loan.update({
					where: { id: openLoan.id },
					data: { returnedAt: now, returnedById: userId }
				});
			} else if (item.boxId === boxId) {
				continue;
			}

			await tx.item.update({ where: { id: item.id }, data: { boxId } });
			await tx.movement.create({
				data: {
					itemId: item.id,
					type: openLoan ? 'RETURNED' : item.boxId ? 'MOVED' : 'STORED',
					fromBoxId: item.boxId,
					toBoxId: boxId,
					loanId: openLoan?.id,
					note,
					userId,
					createdAt: now
				}
			});
		}
		return items.length;
	});
}

/** Lends items to one borrower. Fails if any item is already out. */
export async function checkOutItems(
	itemIds: string[],
	borrower: Borrower,
	options: { dueAt?: Date | null; reason?: string | null },
	userId: string
) {
	if (!borrower.userId && !borrower.name?.trim()) throw new InventoryError('NO_BORROWER');

	return prisma.$transaction(async (tx) => {
		const items = await tx.item.findMany({
			where: { id: { in: itemIds } },
			select: {
				id: true,
				code: true,
				boxId: true,
				loans: { where: { returnedAt: null }, select: { id: true } }
			}
		});
		const alreadyOut = items.filter((item) => item.loans.length > 0);
		if (alreadyOut.length) {
			throw new InventoryError(
				'ITEMS_ALREADY_OUT',
				alreadyOut.map((item) => item.code)
			);
		}
		const now = new Date();

		for (const item of items) {
			const loan = await tx.loan.create({
				data: {
					itemId: item.id,
					borrowerUserId: borrower.userId || null,
					borrowerName: borrower.name?.trim() || null,
					borrowerPhone: borrower.phone?.trim() || null,
					reason: options.reason?.trim() || null,
					dueAt: options.dueAt ?? null,
					checkedOutAt: now,
					createdById: userId
				}
			});
			await tx.item.update({ where: { id: item.id }, data: { boxId: null } });
			await tx.movement.create({
				data: {
					itemId: item.id,
					type: 'CHECKED_OUT',
					fromBoxId: item.boxId,
					loanId: loan.id,
					note: options.reason?.trim() || null,
					userId,
					createdAt: now
				}
			});
		}
		return items.length;
	});
}

export async function setItemsCondition(
	itemIds: string[],
	condition: ItemCondition,
	userId: string,
	note?: string
) {
	return prisma.$transaction(async (tx) => {
		const items = await tx.item.findMany({
			where: { id: { in: itemIds }, condition: { not: condition } },
			select: { id: true, condition: true }
		});
		for (const item of items) {
			await tx.item.update({ where: { id: item.id }, data: { condition } });
			await tx.movement.create({
				data: {
					itemId: item.id,
					type: 'CONDITION_CHANGED',
					fromCondition: item.condition,
					toCondition: condition,
					note,
					userId
				}
			});
		}
		return items.length;
	});
}

/** Box an item came from before its open loan, used as the default return box. */
export async function lastBoxBeforeLoan(itemId: string) {
	const movement = await prisma.movement.findFirst({
		where: { itemId, type: 'CHECKED_OUT', fromBoxId: { not: null } },
		orderBy: { createdAt: 'desc' },
		select: { fromBoxId: true }
	});
	return movement?.fromBoxId ?? null;
}
