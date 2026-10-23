import { randomCode } from '../codes';
import { prisma } from './db';

export { parseScannedCode } from '../codes';

export async function generateItemCode() {
	for (;;) {
		const code = randomCode(6);
		if (!(await prisma.item.findUnique({ where: { code }, select: { id: true } }))) return code;
	}
}

export async function generateBoxCode() {
	for (;;) {
		const code = `B-${randomCode(4)}`;
		if (!(await prisma.box.findUnique({ where: { code }, select: { id: true } }))) return code;
	}
}
