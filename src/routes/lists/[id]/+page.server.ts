import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { itemIdsOf, listSchema } from '#lib/server/item-lists.ts';
import { itemCardSelect, toItemCard } from '#lib/server/items.ts';
import { canEditLists } from '#lib/roles.ts';

export const load: PageServerLoad = async ({ params }) => {
	const list = await prisma.itemList.findUnique({
		where: { id: params.id },
		select: {
			id: true,
			name: true,
			kind: true,
			date: true,
			description: true,
			createdBy: { select: { firstName: true, lastName: true } },
			entries: {
				orderBy: [{ item: { name: 'asc' } }, { item: { code: 'asc' } }],
				select: { item: { select: itemCardSelect } }
			}
		}
	});
	if (!list) error(404);
	const { entries, ...rest } = list;
	return { list: rest, items: entries.map((entry) => toItemCard(entry.item)) };
};

async function editableList(event: RequestEvent<{ id: string }>) {
	requireCapability(event, canEditLists);
	const list = await prisma.itemList.findUnique({
		where: { id: event.params.id },
		select: { id: true }
	});
	if (!list) error(404);
	return list;
}

export const actions: Actions = {
	update: async (event) => {
		const list = await editableList(event);
		const parsed = listSchema.safeParse(Object.fromEntries(await event.request.formData()));
		if (!parsed.success) return fail(400, { invalid: true });
		await prisma.itemList.update({ where: { id: list.id }, data: parsed.data });
		return { saved: true };
	},

	addItems: async (event) => {
		const list = await editableList(event);
		const itemIds = itemIdsOf(await event.request.formData());
		const items = await prisma.item.findMany({
			where: { id: { in: itemIds } },
			select: { id: true }
		});
		const { count } = await prisma.itemListEntry.createMany({
			data: items.map((item) => ({ listId: list.id, itemId: item.id })),
			skipDuplicates: true
		});
		return { added: count };
	},

	removeItems: async (event) => {
		const list = await editableList(event);
		const itemIds = itemIdsOf(await event.request.formData());
		await prisma.itemListEntry.deleteMany({ where: { listId: list.id, itemId: { in: itemIds } } });
		return { removed: true };
	},

	delete: async (event) => {
		const list = await editableList(event);
		await prisma.itemList.delete({ where: { id: list.id } });
		redirect(303, '/lists');
	}
};
