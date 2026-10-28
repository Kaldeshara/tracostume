import type { LayoutServerLoad } from './$types';
import { prisma } from '#lib/server/db.ts';
import { canSeeAllLoans } from '#lib/roles.ts';

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = locals.user;
	// Reminder badge: keepers see all overdue loans, members only their own.
	const overdueCount = user
		? await prisma.loan.count({
				where: {
					returnedAt: null,
					dueAt: { lt: new Date() },
					...(canSeeAllLoans(user.role)
						? {}
						: user.role === 'CHOREOGRAPHER'
							? { OR: [{ contactUserId: user.id }, { borrowerUserId: user.id }] }
							: { borrowerUserId: user.id })
				}
			})
		: 0;
	return { user, overdueCount };
};
