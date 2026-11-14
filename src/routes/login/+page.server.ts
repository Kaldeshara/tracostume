import { fail, redirect } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '#lib/server/db.ts';
import { createSession, safeNext } from '#lib/server/auth.ts';
import { loginFailures } from '#lib/server/rate-limit.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
	return { hasUsers: (await prisma.user.count()) > 0 };
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(form.get('password') ?? '');

		const wait = loginFailures.retryAfter(email);
		if (wait > 0) {
			return fail(429, { email, invalid: false, retryMinutes: Math.ceil(wait / 60_000) });
		}

		const user = await prisma.user.findUnique({ where: { email } });
		if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
			loginFailures.fail(email);
			return fail(400, { email, invalid: true, retryMinutes: 0 });
		}
		loginFailures.reset(email);

		await createSession(cookies, user.id);
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
