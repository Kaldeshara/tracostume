import { fail } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';

const profileSchema = z.object({
	firstName: z.string().trim().min(1).max(100),
	lastName: z.string().trim().min(1).max(100),
	phone: z
		.string()
		.trim()
		.max(40)
		.transform((value) => value || null)
});

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	return {
		profile: await prisma.user.findUniqueOrThrow({
			where: { id: user.id },
			select: { firstName: true, lastName: true, phone: true, email: true }
		})
	};
};

export const actions: Actions = {
	profile: async (event) => {
		const user = requireUser(event);
		const parsed = profileSchema.safeParse(Object.fromEntries(await event.request.formData()));
		if (!parsed.success) return fail(400, { profileInvalid: true });
		await prisma.user.update({ where: { id: user.id }, data: parsed.data });
		return { profileSaved: true };
	},

	password: async (event) => {
		const user = requireUser(event);
		const form = await event.request.formData();
		const current = String(form.get('current') ?? '');
		const next = String(form.get('next') ?? '');
		const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
		if (!(await bcrypt.compare(current, record.passwordHash))) {
			return fail(400, { passwordError: 'wrong' as const });
		}
		if (next.length < 8) return fail(400, { passwordError: 'short' as const });
		await prisma.user.update({
			where: { id: user.id },
			data: { passwordHash: await bcrypt.hash(next, 12) }
		});
		return { passwordSaved: true };
	}
};
