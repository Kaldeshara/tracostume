import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '#lib/server/db.ts';
import { getObject } from '#lib/server/storage.ts';

// Photos are proxied (not linked to the bucket) so they stay private and can be cached
// by the browser: a photo id never changes content.
export const GET: RequestHandler = async ({ params }) => {
	const photo = await prisma.itemPhoto.findUnique({ where: { id: params.id } });
	if (!photo) error(404);

	const body = await getObject(photo.storageKey);
	if (!body) error(404);

	return new Response(body as BodyInit, {
		headers: {
			'Content-Type': photo.mimeType,
			'Cache-Control': 'private, max-age=31536000, immutable'
		}
	});
};
