import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCapability } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { itemIdsOf, listSchema } from '#lib/server/item-lists.ts';
import { canEditLists } from '#lib/roles.ts';

export const load: PageServerLoad = async () => {
	const lists = await prisma.itemList.findMany({
		orderBy: [{ date: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
		select: {
			id: true,
			name: true,
			kind: true,
			date: true,
			description: true,
			createdBy: { select: { firstName: true } },
			entries: {
				select: {
					item: { select: { loans: { where: { returnedAt: null }, select: { id: true } } } }
				}
			}
		}
	});
	return {
		lists: lists.map(({ entries, ...list }) => ({
			...list,
			count: entries.length,
			outCount: entries.filter((entry) => entry.item.loans.length > 0).length
		}))
	};
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireCapability(event, canEditLists);
		const form = await event.request.formData();
		const parsed = listSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { invalid: true });
		const itemIds = itemIdsOf(form);
		const existing = await prisma.item.findMany({
			where: { id: { in: itemIds } },
			select: { id: true }
		});
		const list = await prisma.itemList.create({
			data: {
				...parsed.data,
				createdById: user.id,
				entries: { create: existing.map((item) => ({ itemId: item.id })) }
			}
		});
		redirect(303, `/lists/${list.id}`);
	}
};
