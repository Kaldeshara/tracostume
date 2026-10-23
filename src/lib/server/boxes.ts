import { z } from 'zod';
import type { BoxKind } from '../../generated/prisma/enums';
import { BOX_KINDS } from '#lib/map.ts';
import { prisma } from './db';

/** The troupe has a single container for now; it is created on first use. */
export async function getDefaultContainer() {
	const existing = await prisma.container.findFirst({ orderBy: { createdAt: 'asc' } });
	return existing ?? prisma.container.create({ data: { name: 'Container' } });
}

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.transform((value) => value || null);

const optionalCm = z
	.string()
	.trim()
	.transform((value) => (value ? Math.round(Number(value)) : null))
	.pipe(z.number().int().min(0).max(100000).nullable());

export const boxSchema = z.object({
	label: z.string().trim().min(1).max(200),
	description: optionalText(2000),
	shelf: optionalText(200),
	kind: z.enum(BOX_KINDS as [BoxKind, ...BoxKind[]]).default('PLASTIC_BOX'),
	widthCm: optionalCm,
	depthCm: optionalCm,
	heightCm: optionalCm,
	posXCm: optionalCm,
	posYCm: optionalCm,
	posZCm: optionalCm
});

export const BOX_FIELDS = Object.keys(boxSchema.shape) as (keyof typeof boxSchema.shape)[];

export function readBoxForm(form: FormData) {
	const values = Object.fromEntries(BOX_FIELDS.map((key) => [key, String(form.get(key) ?? '')]));
	return { values, parsed: boxSchema.safeParse(values) };
}
