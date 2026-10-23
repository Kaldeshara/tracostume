import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import type { DoorSide } from '../../../generated/prisma/enums';
import { requireRole } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { getDefaultContainer } from '#lib/server/boxes.ts';
import { DOOR_SIDES } from '#lib/map.ts';

const cm = z.number().int().min(50).max(100000);

// Container settings edited from the 3D map.
const schema = z
	.object({
		name: z.string().trim().min(1).max(200),
		widthCm: cm,
		depthCm: cm,
		heightCm: cm,
		doorSide: z.enum(DOOR_SIDES as [DoorSide, ...DoorSide[]])
	})
	.partial();

export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'KEEPER');
	const parsed = schema.safeParse(await event.request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid container data');
	const container = await getDefaultContainer();
	await prisma.container.update({ where: { id: container.id }, data: parsed.data });
	return json({ ok: true });
};
