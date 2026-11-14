import { randomCode } from '../codes';
import { prisma } from './db';

export { parseScannedCode } from '../codes';

// Codes are printed on labels and resolved by /q/<code> (pieces, then units, then containers),
// so a new code must not be used by any of them. Prefixes already keep them apart (pieces have
// none, units "B-", containers "C-"); the check covers older or hand-made codes too.
async function codeInUse(code: string) {
	const [item, box, container] = await Promise.all([
		prisma.item.findUnique({ where: { code }, select: { id: true } }),
		prisma.box.findUnique({ where: { code }, select: { id: true } }),
		prisma.container.findUnique({ where: { code }, select: { id: true } })
	]);
	return Boolean(item || box || container);
}

async function generateCode(make: () => string) {
	for (;;) {
		const code = make();
		if (!(await codeInUse(code))) return code;
	}
}

export const generateItemCode = () => generateCode(() => randomCode(6));

export const generateBoxCode = () => generateCode(() => `B-${randomCode(4)}`);

export const generateContainerCode = () => generateCode(() => `C-${randomCode(5)}`);
