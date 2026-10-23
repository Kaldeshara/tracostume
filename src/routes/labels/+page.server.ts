import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { qrSvg } from '#lib/server/qr.ts';

const idsOf = (value: string | null) => (value ?? '').split(',').filter(Boolean).slice(0, 500);

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'KEEPER');
	const { url } = event;
	const itemIds = idsOf(url.searchParams.get('items'));
	const boxIds = idsOf(url.searchParams.get('boxes'));
	const all = url.searchParams.get('all'); // "items" | "boxes"

	const [items, boxes] = await Promise.all([
		itemIds.length || all === 'items'
			? prisma.item.findMany({
					where: all === 'items' ? {} : { id: { in: itemIds } },
					select: { code: true, name: true, size: true },
					orderBy: [{ name: 'asc' }, { size: 'asc' }]
				})
			: [],
		boxIds.length || all === 'boxes'
			? prisma.box.findMany({
					where: all === 'boxes' ? {} : { id: { in: boxIds } },
					select: { code: true, label: true },
					orderBy: { label: 'asc' }
				})
			: []
	]);

	const labels = await Promise.all([
		...boxes.map(async (box) => ({
			code: box.code,
			title: box.label,
			subtitle: '',
			qr: await qrSvg(url.origin, box.code)
		})),
		...items.map(async (item) => ({
			code: item.code,
			title: item.name,
			subtitle: item.size ?? '',
			qr: await qrSvg(url.origin, item.code)
		}))
	]);

	return { labels };
};
