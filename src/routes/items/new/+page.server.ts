import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { generateItemCode } from '#lib/server/codes.ts';
import { itemFormOptions, readItemForm, tagsWrite } from '#lib/server/item-form.ts';
import { addItemPhotos, photoFiles } from '#lib/server/photos.ts';

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'KEEPER');
	return {
		options: await itemFormOptions(),
		// Pre-select the box when coming from a box page.
		boxId: event.url.searchParams.get('box') ?? ''
	};
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireRole(event, 'KEEPER');
		const form = await event.request.formData();
		const { values, parsed } = readItemForm(form);
		if (!parsed.success) return fail(400, { values, invalid: true });

		const { tags, size, ...fields } = parsed.data;
		// "36, 38, 38, 40" creates one piece per size; otherwise `quantity` identical pieces.
		const sizes = size?.includes(',')
			? size
					.split(',')
					.map((value) => value.trim())
					.filter(Boolean)
			: Array.from(
					{ length: Math.min(100, Math.max(1, Number(form.get('quantity')) || 1)) },
					() => size
				);
		const photos = photoFiles(form);

		const ids: string[] = [];
		for (const pieceSize of sizes) {
			const item = await prisma.item.create({
				data: {
					...fields,
					size: pieceSize,
					code: await generateItemCode(),
					tags: tagsWrite(tags),
					movements: {
						create: fields.boxId
							? [
									{ type: 'CREATED', userId: user.id },
									{ type: 'STORED', toBoxId: fields.boxId, userId: user.id }
								]
							: [{ type: 'CREATED', userId: user.id }]
					}
				}
			});
			await addItemPhotos(item.id, photos, user.id);
			ids.push(item.id);
		}

		// Several pieces: go straight to their labels so they can be printed and stuck on.
		redirect(303, ids.length === 1 ? `/items/${ids[0]}` : `/labels?items=${ids.join(',')}`);
	}
};
