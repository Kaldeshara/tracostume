import type { PageServerLoad } from './$types';
import { prisma } from '#lib/server/db.ts';
import { canManageStock } from '#lib/roles.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const keeper = canManageStock(locals.user?.role);
	// Members only see what they borrowed; keepers see everything (or just theirs with ?mine).
	const mineOnly = !keeper || url.searchParams.has('mine');

	const loans = await prisma.loan.findMany({
		where: { returnedAt: null, ...(mineOnly ? { borrowerUserId: locals.user!.id } : {}) },
		orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { checkedOutAt: 'asc' }],
		select: {
			id: true,
			dueAt: true,
			checkedOutAt: true,
			reason: true,
			borrowerName: true,
			borrowerPhone: true,
			borrowerUser: { select: { id: true, firstName: true, lastName: true, phone: true } },
			item: {
				select: {
					id: true,
					code: true,
					name: true,
					size: true,
					photos: { orderBy: { position: 'asc' }, take: 1, select: { id: true } }
				}
			}
		}
	});

	return {
		mineOnly,
		loans: loans.map((loan) => ({
			id: loan.id,
			dueAt: loan.dueAt,
			checkedOutAt: loan.checkedOutAt,
			reason: loan.reason,
			borrower: loan.borrowerUser
				? `${loan.borrowerUser.firstName} ${loan.borrowerUser.lastName}`
				: (loan.borrowerName ?? ''),
			phone: loan.borrowerUser?.phone ?? loan.borrowerPhone,
			item: {
				id: loan.item.id,
				code: loan.item.code,
				name: loan.item.name,
				size: loan.item.size,
				photoId: loan.item.photos[0]?.id ?? null
			}
		})),
		keeper
	};
};
