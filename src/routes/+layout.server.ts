import type { LayoutServerLoad } from './$types';
import { prisma } from '#lib/server/db.ts';
import { canSeeAllLoans } from '#lib/roles.ts';
import {
	parseSidebarCollapsed,
	parseThemePreference,
	SEASONAL_COOKIE,
	seasonalTheme,
	SIDEBAR_COOKIE,
	THEME_COOKIE
} from '#lib/theme.ts';

export const load: LayoutServerLoad = async ({ locals, cookies, depends }) => {
	depends('app:appearance');
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
	return {
		user,
		overdueCount,
		theme: parseThemePreference(cookies.get(THEME_COOKIE)),
		season: seasonalTheme(new Date(), cookies.get(SEASONAL_COOKIE)),
		seasonalEnabled: cookies.get(SEASONAL_COOKIE) !== 'off',
		sidebarCollapsed: parseSidebarCollapsed(cookies.get(SIDEBAR_COOKIE))
	};
};
