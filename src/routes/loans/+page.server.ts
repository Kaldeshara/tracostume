import type { PageServerLoad } from './$types';
import { prisma } from '#lib/server/db.ts';
import { canSeeAllLoans } from '#lib/roles.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user!;
	const keeper = canSeeAllLoans(user.role);
	// Keepers see everything (or just theirs with ?mine); choreographers the loans they are the
	// contact for plus their own; everyone else only what they borrowed.
	const mineOnly = !keeper || url.searchParams.has('mine');
	const scope = mineOnly
		? user.role === 'CHOREOGRAPHER' && !url.searchParams.has('mine')
			? { OR: [{ contactUserId: user.id }, { borrowerUserId: user.id }] }
			: { borrowerUserId: user.id }
		: {};

	const loans = await prisma.loan.findMany({
		where: { returnedAt: null, ...scope },
		orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { checkedOutAt: 'asc' }],
		select: {
			id: true,
			dueAt: true,
			checkedOutAt: true,
			reason: true,
			borrowerName: true,
			borrowerPhone: true,
			borrowerUser: { select: { id: true, firstName: true, lastName: true, phone: true } },
			collectedAt: true,
			contactUser: { select: { id: true, firstName: true, lastName: true } },
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
			collectedAt: loan.collectedAt,
			contact: loan.contactUser
				? `${loan.contactUser.firstName} ${loan.contactUser.lastName}`
				: null,
			mine: loan.borrowerUser?.id === user.id,
			item: {
				id: loan.item.id,
				code: loan.item.code,
				name: loan.item.name,
				size: loan.item.size,
				photoId: loan.item.photos[0]?.id ?? null
			}
		})),
		keeper,
		choreographer: user.role === 'CHOREOGRAPHER'
	};
};
