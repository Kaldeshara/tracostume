import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '#lib/server/db.ts';
import { parseScannedCode } from '#lib/server/codes.ts';

// Target of the URLs printed in QR codes, so labels also work with the phone's own camera app.
export const load: PageServerLoad = async ({ params }) => {
	const code = parseScannedCode(params.code);
	const item = await prisma.item.findUnique({ where: { code }, select: { id: true } });
	if (item) redirect(303, `/items/${item.id}`);
	const box = await prisma.box.findUnique({ where: { code }, select: { id: true } });
	if (box) redirect(303, `/boxes/${box.id}`);
	error(404, 'Unknown code');
};
