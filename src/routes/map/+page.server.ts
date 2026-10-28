import type { PageServerLoad } from './$types';
import { prisma } from '#lib/server/db.ts';
import { getDefaultContainer } from '#lib/server/boxes.ts';
import { canManageStock } from '#lib/roles.ts';
import { DEFAULT_CONTAINER } from '#lib/map.ts';

export const load: PageServerLoad = async ({ url, locals }) => {
	const [container, boxes] = await Promise.all([
		getDefaultContainer(),
		prisma.box.findMany({
			orderBy: [{ shelf: 'asc' }, { label: 'asc' }],
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
				heightCm: true,
				_count: { select: { items: true } }
			}
		})
	]);

	// ?items=a,b,c highlights the units holding those items ("where are they?" in 3D).
	const itemIds = (url.searchParams.get('items') ?? '').split(',').filter(Boolean).slice(0, 500);
	const highlighted: Record<string, number> = {};
	if (itemIds.length) {
		const items = await prisma.item.findMany({
			where: { id: { in: itemIds }, boxId: { not: null } },
			select: { boxId: true }
		});
		for (const item of items) highlighted[item.boxId!] = (highlighted[item.boxId!] ?? 0) + 1;
	}

	const measured =
		container.widthCm != null && container.depthCm != null && container.heightCm != null;
	return {
		container: {
			name: container.name,
			doorSide: container.doorSide,
			...(measured
				? {
						widthCm: container.widthCm!,
						depthCm: container.depthCm!,
						heightCm: container.heightCm!
					}
				: DEFAULT_CONTAINER)
		},
		measured,
		boxes: boxes.map(({ _count, ...box }) => ({ ...box, itemCount: _count.items })),
		highlighted,
		initialBoxId: url.searchParams.get('box'),
		editable: canManageStock(locals.user?.role)
	};
};
