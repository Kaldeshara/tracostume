import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { getDefaultContainer } from '#lib/server/boxes.ts';

const optionalCm = z
	.string()
	.trim()
	.transform((value) => (value ? Math.round(Number(value)) : null))
	.pipe(z.number().int().min(0).max(100000).nullable());

const schema = z.object({
	name: z.string().trim().min(1).max(200),
	description: z
		.string()
		.trim()
		.max(2000)
		.transform((value) => value || null),
	widthCm: optionalCm,
	depthCm: optionalCm,
	heightCm: optionalCm
});

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'ADMIN');
	return { container: await getDefaultContainer() };
};

export const actions: Actions = {
	default: async (event) => {
		requireRole(event, 'ADMIN');
		const parsed = schema.safeParse(Object.fromEntries(await event.request.formData()));
		if (!parsed.success) return fail(400, { invalid: true });
		const container = await getDefaultContainer();
		await prisma.container.update({ where: { id: container.id }, data: parsed.data });
		return { saved: true };
	}
};
