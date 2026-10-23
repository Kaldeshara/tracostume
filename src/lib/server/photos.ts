import { randomUUID } from 'node:crypto';
import { prisma } from './db';
import { deleteObject, putObject } from './storage';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export function photoFiles(form: FormData, name = 'photos') {
	return form
		.getAll(name)
		.filter(
			(value): value is File =>
				value instanceof File &&
				value.size > 0 &&
				value.size <= MAX_PHOTO_BYTES &&
				value.type.startsWith('image/')
		);
}

/** Stores the photos and appends them after the item's existing photos. */
export async function addItemPhotos(itemId: string, files: File[], userId: string) {
	if (!files.length) return;
	const last = await prisma.itemPhoto.findFirst({
		where: { itemId },
		orderBy: { position: 'desc' },
		select: { position: true }
	});
	let position = (last?.position ?? -1) + 1;

	for (const file of files) {
		const id = randomUUID();
		const extension =
			file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
		const storageKey = `items/${itemId}/${id}.${extension}`;
		await putObject(storageKey, new Uint8Array(await file.arrayBuffer()), file.type);
		await prisma.itemPhoto.create({
			data: { itemId, storageKey, mimeType: file.type, position: position++, uploadedById: userId }
		});
	}
}

/** Deletes the stored file unless another photo row still uses it. */
async function deleteObjectIfUnused(storageKey: string) {
	const stillUsed = await prisma.itemPhoto.count({ where: { storageKey } });
	if (!stillUsed) await deleteObject(storageKey);
}

export async function deleteItemPhoto(photoId: string) {
	const photo = await prisma.itemPhoto.delete({ where: { id: photoId } });
	await deleteObjectIfUnused(photo.storageKey);
	return photo;
}

/** Removes stored files of items about to be deleted (rows go with the cascade). */
export async function deleteStoredPhotosOfItems(itemIds: string[]) {
	const photos = await prisma.itemPhoto.findMany({
		where: { itemId: { in: itemIds } },
		select: { storageKey: true }
	});
	const keys = [...new Set(photos.map((photo) => photo.storageKey))];
	for (const storageKey of keys) {
		const usedElsewhere = await prisma.itemPhoto.count({
			where: { storageKey, itemId: { notIn: itemIds } }
		});
		if (!usedElsewhere) await deleteObject(storageKey);
	}
}
