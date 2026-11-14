import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { qrSvg } from '#lib/server/qr.ts';

// QR labels go on storage units and the container only (constitution Principle I): pieces are
// grouped in their unit, not labelled.

const idsOf = (value: string | null) => (value ?? '').split(',').filter(Boolean).slice(0, 500);

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'KEEPER');
	const { url } = event;
	const params = url.searchParams;
	const all = params.get('all') === 'units' || params.get('all') === 'boxes';
	const unprinted = params.get('unprinted') === '1';
	const boxIds = idsOf(params.get('boxes'));
	const itemIds = idsOf(params.get('items'));

	// Pieces from a selection or a show list: the units that hold them.
	const pieces = itemIds.length
		? await prisma.item.findMany({
				where: { id: { in: itemIds } },
				select: { id: true, name: true, size: true, boxId: true },
				orderBy: [{ name: 'asc' }, { size: 'asc' }]
			})
		: [];
	const unitIds = [...boxIds, ...pieces.flatMap((piece) => (piece.boxId ? [piece.boxId] : []))];
	const notStored = pieces.filter((piece) => !piece.boxId);

	const unitFilter = all ? {} : unprinted ? { labelPrintedAt: null } : { id: { in: unitIds } };
	const [units, containers] = await Promise.all([
		all || unprinted || unitIds.length
			? prisma.box.findMany({
					where: unitFilter,
					select: { id: true, code: true, label: true, shelf: true },
					orderBy: { label: 'asc' }
				})
			: [],
		all || unprinted
			? prisma.container.findMany({
					where: unprinted ? { labelPrintedAt: null } : {},
					select: { id: true, code: true, name: true },
					orderBy: { createdAt: 'asc' }
				})
			: []
	]);

	const labels = await Promise.all([
		...containers.map(async (container) => ({
			kind: 'container' as const,
			id: container.id,
			code: container.code,
			title: container.name,
			subtitle: '',
			qr: await qrSvg(url.origin, container.code)
		})),
		...units.map(async (unit) => ({
			kind: 'unit' as const,
			id: unit.id,
			code: unit.code,
			title: unit.label,
			subtitle: unit.shelf ?? '',
			qr: await qrSvg(url.origin, unit.code)
		}))
	]);

	return {
		labels,
		notStored: notStored.map(({ id, name, size }) => ({ id, name, size })),
		view: all ? 'all' : unprinted ? 'unprinted' : 'chosen'
	};
};

export const actions: Actions = {
	/** The keeper confirms the sheet was printed: those labels no longer count as "not printed". */
	printed: async (event) => {
		requireRole(event, 'KEEPER');
		const form = await event.request.formData();
		const ids = (name: string) => form.getAll(name).map(String).filter(Boolean).slice(0, 500);
		const now = new Date();
		await prisma.$transaction([
			prisma.box.updateMany({
				where: { id: { in: ids('unitId') } },
				data: { labelPrintedAt: now }
			}),
			prisma.container.updateMany({
				where: { id: { in: ids('containerId') } },
				data: { labelPrintedAt: now }
			})
		]);
		return { printed: true };
	}
};
