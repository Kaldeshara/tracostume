import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import type { BoxKind } from '../../../generated/prisma/enums';
import { requireRole } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { getDefaultContainer } from '#lib/server/boxes.ts';
import { generateBoxCode } from '#lib/server/codes.ts';
import { BOX_KINDS } from '#lib/map.ts';

const cm = z.number().int().min(0).max(100000);

// Creates a storage unit from the 3D map, already placed.
const schema = z.object({
	label: z.string().trim().min(1).max(200),
	kind: z.enum(BOX_KINDS as [BoxKind, ...BoxKind[]]),
	posXCm: cm,
	posYCm: cm,
	posZCm: cm,
	widthCm: cm,
	depthCm: cm,
	heightCm: cm
});

export const POST: RequestHandler = async (event) => {
	requireRole(event, 'KEEPER');
	const parsed = schema.safeParse(await event.request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid box data');

	const container = await getDefaultContainer();
	const box = await prisma.box.create({
		data: { ...parsed.data, code: await generateBoxCode(), containerId: container.id },
		select: {
			id: true,
			code: true,
			label: true,
			shelf: true,
			kind: true,
			posXCm: true,
			posYCm: true,
			posZCm: true,
			widthCm: true,
			depthCm: true,
			heightCm: true
		}
	});
	return json({ ...box, itemCount: 0 });
};
