import type { PageServerLoad } from './$types';
import { prisma } from '#lib/server/db.ts';
import { canManageStock } from '#lib/roles.ts';

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

	return {
		stats: { itemCount, outCount, overdueCount, attentionCount },
		myLoans: myLoans.map((loan) => ({
			id: loan.id,
			dueAt: loan.dueAt,
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
