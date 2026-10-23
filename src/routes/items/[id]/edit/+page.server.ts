import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { itemFormOptions, readItemForm, tagsWrite } from '#lib/server/item-form.ts';
import { setItemsCondition } from '#lib/server/inventory.ts';

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'KEEPER');
	const item = await prisma.item.findUnique({
		where: { id: event.params.id },
		include: { tags: { include: { tag: true } } }
	});
	if (!item) error(404);

	return {
		item: { id: item.id, code: item.code },
		values: {
			name: item.name,
			description: item.description ?? '',
			category: item.category ?? '',
			color: item.color ?? '',
			size: item.size ?? '',
			condition: item.condition,
			tags: item.tags.map(({ tag }) => tag.name).join(', '),
			boxId: item.boxId ?? ''
		},
		options: await itemFormOptions()
	};
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireRole(event, 'KEEPER');
		const { values, parsed } = readItemForm(await event.request.formData());
		if (!parsed.success) return fail(400, { values, invalid: true });

		// Location changes go through the stock actions so they are recorded in the history.
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { tags, condition, boxId, ...fields } = parsed.data;
		const id = event.params.id;
		await prisma.item.update({
			where: { id },
			data: { ...fields, tags: { deleteMany: {}, ...tagsWrite(tags) } }
		});
		await setItemsCondition([id], condition, user.id);
		redirect(303, `/items/${id}`);
	}
};
