import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '#lib/server/db.ts';
import { parseScannedCode } from '#lib/server/codes.ts';
import { itemCardSelect, toItemCard } from '#lib/server/items.ts';

/** Resolves a scanned QR value to a piece, a storage unit or the container. */
export const GET: RequestHandler = async ({ url }) => {
	const code = parseScannedCode(url.searchParams.get('code') ?? '');
	if (!code) return json({ type: 'unknown', code });

	const item = await prisma.item.findUnique({ where: { code }, select: itemCardSelect });
	if (item) return json({ type: 'item', item: toItemCard(item) });

	const box = await prisma.box.findUnique({
		where: { code },
		select: { id: true, code: true, label: true, shelf: true, _count: { select: { items: true } } }
	});
	if (box) return json({ type: 'box', box });
	const container = await prisma.container.findUnique({
		where: { code },
		select: { id: true, code: true, name: true }
	});
	if (container) return json({ type: 'container', container });
	return json({ type: 'unknown', code });
};
