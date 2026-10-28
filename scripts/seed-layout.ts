import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import type { BoxKind } from '../src/generated/prisma/enums';
import { randomCode } from '../src/lib/codes';

// Creates the storage units of the troupe's storage unit as photographed on 2026-10-27
// (assets/*.jpg, named by wall: left_front, left_back, middle_back, right_back, right…): an
// approximation to refine on the 3D map. Positions are cm from the back-left
// floor corner; the door is on the front wall (y = depth).
//
//   npx tsx scripts/seed-layout.ts            # refuses to run if the layout already exists
//   npx tsx scripts/seed-layout.ts --reset    # deletes the previous layout's empty units first

const MARK = 'Plan initial (photos du 27/10/2026)';
const CONTAINER = {
	name: 'Box de stockage',
	widthCm: 270,
	depthCm: 335,
	heightCm: 190,
	doorSide: 'FRONT' as const
};

type Unit = {
	label: string;
	kind: BoxKind;
	x: number;
	y: number;
	z: number;
	w: number;
	d: number;
	h: number;
	shelf?: string;
};
const units: Unit[] = [];
const add = (unit: Unit) => units.push(unit);

/** Stacks `labels.length` units of one size at a floor position, bottom first. */
function column(
	labels: string[],
	kind: BoxKind,
	x: number,
	y: number,
	size: { w: number; d: number; h: number },
	shelf: string,
	z0 = 0
) {
	labels.forEach((label, level) =>
		add({ label, kind, x, y, z: z0 + level * size.h, ...size, shelf })
	);
}

// --- Left wall: cardboard archive boxes, five high, from the door towards the back ----------
const CARTON = { w: 60, d: 40, h: 35 };
const leftLabels = [
	// Column nearest the door (on top of the grey chest), bottom → top.
	[
		'T-shirts garçons multicolores',
		'Shorts noir, blanc, gris, bleu marine',
		'Pulls, t-shirts et hauts',
		'T-shirts rose, bleu, vert, blanc (G)'
	],
	[
		'T-shirts blancs manches longues, col roulé bleu, Aladin',
		'Ceintures et chaussettes longues (mixtes)',
		'Leggings bleu, noir, kaki, blanc',
		'T-shirts rouge, noir, bleu (G)',
		'T-shirts blancs ×2 (mixtes)'
	],
	[
		'Chemisettes rouge, bleu, violet',
		'Cirque',
		'Chemises et chemisettes',
		'Ceintures et cravates',
		'Tenues hôtesses et combinaisons'
	],
	['Carton 16', 'Carton 17', 'Carton 18', 'Carton 19', 'Naruto et costumes complets'],
	['Carton 21', 'Carton 22', 'Carton 23', 'Carton 24', 'Carton 25']
];
add({
	label: 'Commode grise (tiroirs)',
	kind: 'OTHER',
	x: 0,
	y: 285,
	z: 0,
	w: 80,
	d: 45,
	h: 70,
	shelf: 'Mur gauche, près de la porte'
});
column(leftLabels[0], 'CARDBOARD_BOX', 10, 290, CARTON, 'Mur gauche, près de la porte', 70);
column(leftLabels[1], 'CARDBOARD_BOX', 0, 245, CARTON, 'Mur gauche');
column(leftLabels[2], 'CARDBOARD_BOX', 0, 205, CARTON, 'Mur gauche');
column(leftLabels[3], 'CARDBOARD_BOX', 0, 165, CARTON, 'Mur gauche, milieu');
column(leftLabels[4], 'CARDBOARD_BOX', 0, 125, CARTON, 'Mur gauche, vers le fond');

// --- Back wall: transparent plastic boxes in columns, then the fabric box with the La Perla boxes --
const PLASTIC = { w: 58, d: 39, h: 30 };
column(
	['Boîte 1', 'Boîte 2', 'Boîte 3', 'Boîte 4', 'Boîte 5', 'Boîte 6'],
	'PLASTIC_BOX',
	0,
	0,
	PLASTIC,
	'Fond, coin gauche'
);
column(
	['Boîte 7', 'Boîte 8', 'Boîte 9', 'Boîte 10', 'Boîte 11', 'Boîte 12'],
	'PLASTIC_BOX',
	60,
	0,
	PLASTIC,
	'Fond, à gauche'
);
column(
	[
		'Boîte 13',
		'Salopettes et shorts, jeans + divers',
		'Boîte 15',
		'Hauts Pierrot, pantalons larges jaunes, écossais (clowns)',
		'Hommes (coiffes)',
		'Boîte 18'
	],
	'PLASTIC_BOX',
	130,
	0,
	PLASTIC,
	'Fond, au centre'
);
column(
	['Boîte 19', 'Boîte 20', 'Boîte 21', 'Boîte 22', 'Boîte 23'],
	'PLASTIC_BOX',
	190,
	0,
	PLASTIC,
	'Fond, à droite'
);
add({
	label: 'Boîte en tissu verte',
	kind: 'CANVAS_BAG',
	x: 190,
	y: 0,
	z: 150,
	w: 60,
	d: 40,
	h: 30,
	shelf: 'Fond, à droite, en haut'
});
const LA_PERLA = { w: 34, d: 22, h: 8 };
column(
	[
		'Accessoires filles : ceintures, cravates, nœuds',
		'Cravates 7 marron, 2 blanches',
		'Gants noirs longs 5 paires',
		'Nœuds papillon argent, rouge paillettes, multicolore, noir, blanc, bleu',
		'Cravates paillettes'
	],
	'OTHER',
	190,
	5,
	LA_PERLA,
	'Fond à droite, pile La Perla gauche',
	180
);
column(
	[
		'Bretelles beiges et marron à pinces',
		'Gants rouges 5 paires longs',
		'Gants et mitaines blancs 5 paires',
		'Bretelles noires à pince, 5 à boutons, 2 rouges, 2 grises',
		'Cravates noires',
		'Cravates velours et écossaises'
	],
	'OTHER',
	228,
	5,
	LA_PERLA,
	'Fond à droite, pile La Perla droite',
	180
);

// --- Right wall (photos right_back*, right, righ_entrance_ground): plastic columns in the back
// corner, the clothes rail along the wall, the navy garment bags on the floor by the entrance ---
column(
	['Boîte 24', 'Boîte 25', 'Boîte 26', 'Boîte 27', 'Boîte 28'],
	'PLASTIC_BOX',
	212,
	42,
	PLASTIC,
	'Mur droit, coin du fond'
);
column(
	['Boîte 29', 'Boîte 30', 'Boîte 31', 'Boîte 32', 'Boîte 33'],
	'PLASTIC_BOX',
	212,
	81,
	PLASTIC,
	'Mur droit, vers le fond'
);
column(
	['Boîte 34', 'Boîte 35', 'Boîte 36', 'Boîte 37', 'Boîte 38'],
	'PLASTIC_BOX',
	212,
	120,
	PLASTIC,
	'Mur droit, vers le fond'
);
add({
	label: 'Portant (housses bleues et noires)',
	kind: 'RACK',
	x: 222,
	y: 165,
	z: 0,
	// The rail runs along the wall: its bar is the depth axis.
	w: 45,
	d: 120,
	h: 170,
	shelf: 'Mur droit, milieu'
});
add({
	label: 'Housse bleu marine 1 (au sol)',
	kind: 'CANVAS_BAG',
	x: 150,
	y: 190,
	z: 0,
	w: 60,
	d: 90,
	h: 35,
	shelf: 'Au sol, à droite devant le portant'
});
add({
	label: 'Housse bleu marine 2 (au sol)',
	kind: 'CANVAS_BAG',
	x: 150,
	y: 240,
	z: 35,
	w: 60,
	d: 90,
	h: 35,
	shelf: 'Au sol, à droite devant le portant'
});

// --- Door area, right side (photo right): step stool with the IKEA box and the Action bag -----
add({
	label: 'Marchepied',
	kind: 'OTHER',
	x: 215,
	y: 290,
	z: 0,
	w: 45,
	d: 35,
	h: 45,
	shelf: 'À droite de la porte'
});
add({
	label: 'Carton IKEA (vanity)',
	kind: 'CARDBOARD_BOX',
	x: 210,
	y: 288,
	z: 45,
	w: 55,
	d: 40,
	h: 40,
	shelf: 'À droite de la porte, sur le marchepied'
});
add({
	label: 'Sac Action (tissus rouges et bleus)',
	kind: 'CANVAS_BAG',
	x: 215,
	y: 290,
	z: 85,
	w: 50,
	d: 40,
	h: 35,
	shelf: 'À droite de la porte, sur le carton'
});

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

async function uniqueBoxCode() {
	for (;;) {
		const code = `B-${randomCode(4)}`;
		if (!(await prisma.box.findUnique({ where: { code }, select: { id: true } }))) return code;
	}
}

async function main() {
	const reset = process.argv.includes('--reset');
	const previous = await prisma.box.findMany({
		where: { description: MARK },
		select: { id: true, _count: { select: { items: true } } }
	});
	if (previous.length) {
		if (!reset)
			throw new Error(`${previous.length} units of this layout already exist; use --reset.`);
		const empty = previous.filter((box) => box._count.items === 0).map((box) => box.id);
		await prisma.box.deleteMany({ where: { id: { in: empty } } });
		console.log(
			`Deleted ${empty.length} empty units of the previous layout (${previous.length - empty.length} kept: they hold items).`
		);
	}

	const container =
		(await prisma.container.findFirst({ orderBy: { createdAt: 'asc' } })) ??
		(await prisma.container.create({ data: { name: CONTAINER.name } }));
	await prisma.container.update({ where: { id: container.id }, data: CONTAINER });

	for (const unit of units) {
		await prisma.box.create({
			data: {
				code: await uniqueBoxCode(),
				label: unit.label,
				kind: unit.kind,
				shelf: unit.shelf,
				description: MARK,
				posXCm: unit.x,
				posYCm: unit.y,
				posZCm: unit.z,
				widthCm: unit.w,
				depthCm: unit.d,
				heightCm: unit.h,
				containerId: container.id
			}
		});
	}
	console.log(
		`Container set to ${CONTAINER.widthCm} × ${CONTAINER.depthCm} × ${CONTAINER.heightCm} cm; ${units.length} units created.`
	);
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
