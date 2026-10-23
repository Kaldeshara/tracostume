import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { UserRole } from '../../generated/prisma/enums';
import { requireRole } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { hasRole, ROLES } from '#lib/roles.ts';

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'ADMIN');
	const users = await prisma.user.findMany({
		orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
		select: {
			id: true,
			firstName: true,
			lastName: true,
			email: true,
			phone: true,
			role: true,
			_count: { select: { borrowedLoans: { where: { returnedAt: null } } } }
		}
	});
	return { users };
};

export const actions: Actions = {
	setRole: async (event) => {
		const me = requireRole(event, 'ADMIN');
		const form = await event.request.formData();
		const userId = String(form.get('userId') ?? '');
		const role = String(form.get('role') ?? '') as UserRole;
		if (!ROLES.includes(role)) return fail(400);

		const target = await prisma.user.findUnique({ where: { id: userId } });
		if (!target || target.id === me.id) return fail(400);
		// Only the owner can create or demote another owner.
		if ((role === 'OWNER' || target.role === 'OWNER') && !hasRole(me.role, 'OWNER')) {
			return fail(403);
		}
		await prisma.user.update({ where: { id: userId }, data: { role } });
		return { saved: true };
	}
};
