import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { getDefaultContainer, readBoxForm } from '#lib/server/boxes.ts';
import { generateBoxCode } from '#lib/server/codes.ts';

export const load: PageServerLoad = async () => {
	const containers = await prisma.container.findMany({
		orderBy: { createdAt: 'asc' },
		select: {
			id: true,
			name: true,
			boxes: {
				orderBy: [{ shelf: 'asc' }, { label: 'asc' }],
				select: {
					id: true,
					code: true,
					label: true,
					shelf: true,
					description: true,
					_count: { select: { items: true } }
				}
			}
		}
	});
	return { containers };
};

export const actions: Actions = {
	create: async (event) => {
		requireRole(event, 'KEEPER');
		const { values, parsed } = readBoxForm(await event.request.formData());
		if (!parsed.success) return fail(400, { values, invalid: true });

		const container = await getDefaultContainer();
		const box = await prisma.box.create({
			data: { ...parsed.data, code: await generateBoxCode(), containerId: container.id }
		});
		redirect(303, `/boxes/${box.id}`);
	}
};
