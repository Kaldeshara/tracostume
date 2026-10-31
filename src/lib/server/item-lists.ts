import { z } from 'zod';

// Shared by the costume sets / show lists pages.

export const listSchema = z.object({
	name: z.string().trim().min(1).max(120),
	kind: z.enum(['SET', 'SHOW']),
	description: z
		.string()
		.trim()
		.max(1000)
		.optional()
		.transform((value) => value || null),
	date: z
		.string()
		.optional()
		.transform((value) => {
			if (!value) return null;
			const date = new Date(`${value}T12:00:00`);
			return Number.isNaN(date.getTime()) ? null : date;
		})
});

/** The `itemId` fields of a form, deduplicated. */
export const itemIdsOf = (form: FormData) =>
	[...new Set(form.getAll('itemId').map(String))].filter(Boolean).slice(0, 500);
