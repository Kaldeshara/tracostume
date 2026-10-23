import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { readBoxForm } from '#lib/server/boxes.ts';
import { itemCardSelect, toItemCard } from '#lib/server/items.ts';
import { qrSvg } from '#lib/server/qr.ts';

export const load: PageServerLoad = async ({ params, url }) => {
	const box = await prisma.box.findUnique({
		where: { id: params.id },
		include: {
			container: { select: { name: true } },
			items: { select: itemCardSelect, orderBy: [{ name: 'asc' }, { size: 'asc' }] }
		}
	});
	if (!box) error(404);

	const { items, ...rest } = box;
	return { box: rest, items: items.map(toItemCard), qr: await qrSvg(url.origin, box.code) };
};

export const actions: Actions = {
	update: async (event) => {
		requireRole(event, 'KEEPER');
		const { values, parsed } = readBoxForm(await event.request.formData());
		if (!parsed.success) return fail(400, { values, invalid: true });
		await prisma.box.update({ where: { id: event.params.id }, data: parsed.data });
		return { saved: true };
	},

	delete: async (event) => {
		requireRole(event, 'ADMIN');
		const count = await prisma.item.count({ where: { boxId: event.params.id } });
		if (count > 0) return fail(400, { notEmpty: true });
		await prisma.box.delete({ where: { id: event.params.id } });
		redirect(303, '/boxes');
	}
};
