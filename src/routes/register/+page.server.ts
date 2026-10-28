import { fail, redirect } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '#lib/server/db.ts';
import {
	createSession,
	isRegistrationPasswordRequired,
	registrationPasswordMatches,
	safeNext
} from '#lib/server/auth.ts';

const schema = z.object({
	firstName: z.string().trim().min(1).max(100),
	lastName: z.string().trim().min(1).max(100),
	email: z.string().trim().toLowerCase().pipe(z.email()),
	phone: z.string().trim().max(40).optional(),
	password: z.string().min(8).max(200)
});

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, '/');
	return { passwordRequired: isRegistrationPasswordRequired() };
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = Object.fromEntries(await request.formData()) as Record<string, string>;
		const values = {
			firstName: form.firstName ?? '',
			lastName: form.lastName ?? '',
			email: form.email ?? '',
			phone: form.phone ?? ''
		};

		if (!registrationPasswordMatches(form.registeringPassword)) {
			return fail(400, { values, error: 'registeringPassword' as const });
		}
		const parsed = schema.safeParse(form);
		if (!parsed.success) {
			return fail(400, { values, error: 'invalid' as const });
		}
		const { password, ...data } = parsed.data;
		if (await prisma.user.findUnique({ where: { email: data.email } })) {
			return fail(400, { values, error: 'emailTaken' as const });
		}

		// The very first account owns the app; everyone else starts as a member and
		// is promoted by an admin.
		const isFirst = (await prisma.user.count()) === 0;
		const user = await prisma.user.create({
			data: {
				...data,
				phone: data.phone || null,
				role: isFirst ? 'OWNER' : 'DANCER',
				passwordHash: await bcrypt.hash(password, 12)
			}
		});

		await createSession(cookies, user.id);
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
