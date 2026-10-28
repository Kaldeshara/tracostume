import type { PageServerLoad } from './$types';
import { prisma } from '#lib/server/db.ts';
import { canManageStock, isRepairer } from '#lib/roles.ts';
import { itemCardSelect, toItemCard } from '#lib/server/items.ts';
import { REPAIR_CONDITIONS } from '#lib/server/stock-actions.ts';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const now = new Date();
	const openLoan = { returnedAt: null };

	const [itemCount, outCount, overdueCount, attentionCount, myLoans] = await Promise.all([
		prisma.item.count({ where: { condition: { notIn: ['LOST', 'RETIRED'] } } }),
		prisma.loan.count({ where: openLoan }),
		prisma.loan.count({ where: { ...openLoan, dueAt: { lt: now } } }),
		prisma.item.count({
			where: { condition: { in: ['TO_WASH', 'TO_REPAIR', 'IN_REPAIR', 'DAMAGED'] } }
		}),
		prisma.loan.findMany({
			where: { ...openLoan, borrowerUserId: user.id },
			orderBy: { dueAt: { sort: 'asc', nulls: 'last' } },
			select: {
				id: true,
				dueAt: true,
				collectedAt: true,
				contactUser: { select: { firstName: true, lastName: true } },
				item: {
					select: {
						id: true,
						name: true,
						code: true,
						photos: { orderBy: { position: 'asc' }, take: 1, select: { id: true } }
					}
				}
			}
		})
	]);

	// Repairers: their to-do list. Choreographers: the pieces lent to their dancers.
	const repairItems = isRepairer(user.role)
		? (
				await prisma.item.findMany({
					where: { condition: { in: REPAIR_CONDITIONS } },
					select: itemCardSelect,
					orderBy: [{ condition: 'asc' }, { name: 'asc' }]
				})
			).map(toItemCard)
		: [];
	const contactLoans =
		user.role === 'CHOREOGRAPHER'
			? await prisma.loan.findMany({
					where: { ...openLoan, contactUserId: user.id },
					orderBy: [
						{ collectedAt: { sort: 'asc', nulls: 'first' } },
						{ dueAt: { sort: 'asc', nulls: 'last' } }
					],
					select: {
						id: true,
						dueAt: true,
						collectedAt: true,
						borrowerName: true,
						borrowerUser: { select: { firstName: true, lastName: true } },
						item: {
							select: {
								id: true,
								name: true,
								code: true,
								photos: { orderBy: { position: 'asc' }, take: 1, select: { id: true } }
							}
						}
					}
				})
			: [];

	return {
		role: user.role,
		repairItems,
		contactLoans: contactLoans.map((loan) => ({
			id: loan.id,
			dueAt: loan.dueAt,
			collectedAt: loan.collectedAt,
			borrower: loan.borrowerUser
				? `${loan.borrowerUser.firstName} ${loan.borrowerUser.lastName}`
				: (loan.borrowerName ?? ''),
			item: {
				id: loan.item.id,
				name: loan.item.name,
				code: loan.item.code,
				photoId: loan.item.photos[0]?.id ?? null
			}
		})),
		stats: { itemCount, outCount, overdueCount, attentionCount },
		myLoans: myLoans.map((loan) => ({
			id: loan.id,
			dueAt: loan.dueAt,
			collectedAt: loan.collectedAt,
			contact: loan.contactUser
				? `${loan.contactUser.firstName} ${loan.contactUser.lastName}`
				: null,
			item: {
				id: loan.item.id,
				name: loan.item.name,
				code: loan.item.code,
				photoId: loan.item.photos[0]?.id ?? null
			}
		})),
		keeper: canManageStock(user.role)
	};
};
