import { z } from 'zod';
import { CONDITIONS } from '#lib/format.ts';
import { CATEGORIES } from '#lib/categories.ts';
import type { ItemCategory, ItemCondition } from '../../generated/prisma/enums';
import { prisma } from './db';

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.transform((value) => value || null);

export const itemSchema = z.object({
	name: z.string().trim().min(1).max(200),
	description: optionalText(4000),
	category: z.enum(CATEGORIES as [ItemCategory, ...ItemCategory[]]),
	color: optionalText(100),
	size: optionalText(200),
	condition: z.enum(CONDITIONS as [ItemCondition, ...ItemCondition[]]),
	tags: z
		.string()
		.transform((value) =>
			[...new Set(value.split(',').map((tag) => tag.trim().toLowerCase()))]
				.filter(Boolean)
				.slice(0, 30)
		),
	boxId: optionalText(50)
});

export type ItemFormValues = Record<keyof z.input<typeof itemSchema>, string>;

export function readItemForm(form: FormData) {
	const values = Object.fromEntries(
		(
			['name', 'description', 'category', 'color', 'size', 'condition', 'tags', 'boxId'] as const
		).map((key) => [key, String(form.get(key) ?? '')])
	) as ItemFormValues;
	return { values, parsed: itemSchema.safeParse(values) };
}

/** Nested write that replaces an item's tags, creating unknown ones. */
export function tagsWrite(tags: string[]) {
	return {
		create: tags.map((name) => ({
			tag: { connectOrCreate: { where: { name }, create: { name } } }
		}))
	};
}

/** Suggestions for the item form's free-text fields. */
export async function itemFormOptions() {
	const [boxes, colors, tags] = await Promise.all([
		prisma.box.findMany({
			select: { id: true, code: true, label: true },
			orderBy: { label: 'asc' }
		}),
		prisma.item.findMany({
			where: { color: { not: null } },
			distinct: ['color'],
			select: { color: true },
			orderBy: { color: 'asc' }
		}),
		prisma.tag.findMany({ select: { name: true }, orderBy: { name: 'asc' } })
	]);
	return {
		boxes,
		colors: colors.map((row) => row.color!),
		tags: tags.map((row) => row.name)
	};
}
