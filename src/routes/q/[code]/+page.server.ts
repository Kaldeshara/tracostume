import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '#lib/server/db.ts';
import { parseScannedCode } from '#lib/server/codes.ts';
import { resolveScannedCode } from '#lib/server/scan-resolve.ts';

// Target of the URLs printed in QR codes, so labels also work with the phone's own camera app.
// Labels go on storage units and the container; old piece links keep working (Principle I).
export const load: PageServerLoad = async ({ params }) => {
	const select = { id: true } as const;
	const target = await resolveScannedCode(parseScannedCode(params.code), {
		item: (code) => prisma.item.findUnique({ where: { code }, select }),
		box: (code) => prisma.box.findUnique({ where: { code }, select }),
		container: (code) => prisma.container.findUnique({ where: { code }, select })
	});
	if (target?.type === 'item') redirect(303, `/items/${target.id}`);
	if (target?.type === 'box') redirect(303, `/boxes/${target.id}`);
	if (target?.type === 'container') redirect(303, '/boxes');
	error(404, 'Unknown code');
};
