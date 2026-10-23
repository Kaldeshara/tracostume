import type { LayoutServerLoad } from './$types';
import { prisma } from '#lib/server/db.ts';
import { canManageStock } from '#lib/roles.ts';

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = locals.user;
	// Reminder badge: keepers see all overdue loans, members only their own.
	const overdueCount = user
		? await prisma.loan.count({
				where: {
					returnedAt: null,
					dueAt: { lt: new Date() },
					...(canManageStock(user.role) ? {} : { borrowerUserId: user.id })
				}
			})
		: 0;
	return { user, overdueCount };
};
