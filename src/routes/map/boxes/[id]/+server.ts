import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import type { BoxKind } from '../../../../generated/prisma/enums';
import { requireRole } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { BOX_KINDS } from '#lib/map.ts';

const cm = z.number().int().min(0).max(100000);

// Edits made on the 3D map: geometry, kind and label of a storage unit.
const schema = z
	.object({
		label: z.string().trim().min(1).max(200),
		kind: z.enum(BOX_KINDS as [BoxKind, ...BoxKind[]]),
		posXCm: cm.nullable(),
		posYCm: cm.nullable(),
		posZCm: cm.nullable(),
		widthCm: cm.nullable(),
		depthCm: cm.nullable(),
		heightCm: cm.nullable()
	})
	.partial();

export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'KEEPER');
	const parsed = schema.safeParse(await event.request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid box data');

	const box = await prisma.box.findUnique({ where: { id: event.params.id }, select: { id: true } });
	if (!box) error(404);

	await prisma.box.update({ where: { id: box.id }, data: parsed.data });
	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'ADMIN');
	const count = await prisma.item.count({ where: { boxId: event.params.id } });
	if (count > 0) error(409, 'Box is not empty');
	await prisma.box.delete({ where: { id: event.params.id } });
	return json({ ok: true });
};
