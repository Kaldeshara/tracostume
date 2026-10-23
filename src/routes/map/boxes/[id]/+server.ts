import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireRole } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';

const cm = z.number().int().min(0).max(100000);

// Position and size edits made on the 3D map.
const schema = z.object({
	posXCm: cm.nullable(),
	posYCm: cm.nullable(),
	posZCm: cm.nullable(),
	widthCm: cm.nullable(),
	depthCm: cm.nullable(),
	heightCm: cm.nullable()
});

export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'KEEPER');
	const parsed = schema.safeParse(await event.request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid box geometry');

	const box = await prisma.box.findUnique({ where: { id: event.params.id }, select: { id: true } });
	if (!box) error(404);

	await prisma.box.update({ where: { id: box.id }, data: parsed.data });
	return json({ ok: true });
};
