import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { lastBoxBeforeLoan } from '#lib/server/inventory.ts';
import { toItemCard, itemCardSelect } from '#lib/server/items.ts';
import {
	addItemPhotos,
	deleteItemPhoto,
	deleteStoredPhotosOfItems,
	photoFiles
} from '#lib/server/photos.ts';
import { qrSvg } from '#lib/server/qr.ts';
import { stockActionOptions, stockActions } from '#lib/server/stock-actions.ts';
import { canCheckOut, canCollect, canSetCondition, isRepairer } from '#lib/roles.ts';
import { REPAIR_CONDITIONS } from '#lib/server/stock-actions.ts';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const item = await prisma.item.findUnique({
		where: { id: params.id },
		select: {
			...itemCardSelect,
			description: true,
			createdAt: true,
			photos: { orderBy: { position: 'asc' }, select: { id: true } },
			tags: { select: { tag: { select: { name: true } } } },
			loans: {
				where: { returnedAt: null },
				take: 1,
				select: {
					...itemCardSelect.loans.select,
					borrowerPhone: true,
					reason: true,
					borrowerUser: { select: { firstName: true, lastName: true, phone: true, email: true } }
				}
			},
			movements: {
				orderBy: { createdAt: 'desc' },
				take: 50,
				select: {
					id: true,
					type: true,
					createdAt: true,
					note: true,
					fromCondition: true,
					toCondition: true,
					fromBox: { select: { code: true, label: true } },
					toBox: { select: { code: true, label: true } },
					loan: {
						select: {
							borrowerName: true,
							borrowerUser: { select: { firstName: true, lastName: true } }
						}
					},
					user: { select: { firstName: true, lastName: true } }
				}
			}
		}
	});
	if (!item) error(404);

	if (isRepairer(locals.user?.role) && !REPAIR_CONDITIONS.includes(item.condition)) error(403);
	const openLoan = item.loans[0];
	const role = locals.user?.role;
	const acts = canSetCondition(role) || canCheckOut(role) || canCollect(role);

	return {
		item: {
			...toItemCard({ ...item, photos: item.photos.slice(0, 1) }),
			description: item.description,
			photoIds: item.photos.map((photo) => photo.id),
			tags: item.tags.map(({ tag }) => tag.name),
			loanDetails: openLoan
				? {
						reason: openLoan.reason,
						phone: openLoan.borrowerUser?.phone ?? openLoan.borrowerPhone,
						email: openLoan.borrowerUser?.email ?? null
					}
				: null
		},
		movements: item.movements,
		qr: await qrSvg(url.origin, item.code),
		stock: acts ? await stockActionOptions() : null,
		defaultBoxId: item.box?.id ?? (openLoan ? await lastBoxBeforeLoan(item.id) : null)
	};
};

export const actions: Actions = {
	...stockActions,

	addPhotos: async (event) => {
		const user = requireRole(event, 'KEEPER');
		await addItemPhotos(event.params.id, photoFiles(await event.request.formData()), user.id);
		return { done: 'photos' as const };
	},

	deletePhoto: async (event) => {
		requireRole(event, 'KEEPER');
		const photoId = String((await event.request.formData()).get('photoId') ?? '');
		const photo = await prisma.itemPhoto.findUnique({ where: { id: photoId } });
		if (!photo || photo.itemId !== event.params.id) return fail(404);
		await deleteItemPhoto(photoId);
		return { done: 'deletePhoto' as const };
	},

	delete: async (event) => {
		requireRole(event, 'ADMIN');
		await deleteStoredPhotosOfItems([event.params.id]);
		await prisma.item.delete({ where: { id: event.params.id } });
		redirect(303, '/items');
	}
};
