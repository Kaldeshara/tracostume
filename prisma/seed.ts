import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import type { ItemCategory } from '../src/generated/prisma/enums';

// Demo data for local development. Safe to run several times: it only adds what is missing.

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

const DAY = 24 * 3600 * 1000;

async function main() {
	const passwordHash = await bcrypt.hash('password123', 12);
	const users = [
		{ email: 'alice@example.com', firstName: 'Alice', lastName: 'Martin', role: 'OWNER' as const },
		{ email: 'karim@example.com', firstName: 'Karim', lastName: 'Benali', role: 'KEEPER' as const },
		{ email: 'lea@example.com', firstName: 'Léa', lastName: 'Dupont', role: 'DANCER' as const },
		{
			email: 'chloe@example.com',
			firstName: 'Chloé',
			lastName: 'Bernard',
			role: 'CHOREOGRAPHER' as const
		},
		{ email: 'remi@example.com', firstName: 'Rémi', lastName: 'Garcia', role: 'REPAIRER' as const }
	];
	for (const user of users) {
		await prisma.user.upsert({
			where: { email: user.email },
			update: {},
			create: { ...user, phone: '+33 6 12 34 56 78', passwordHash }
		});
	}
	const alice = await prisma.user.findUniqueOrThrow({ where: { email: 'alice@example.com' } });
	const lea = await prisma.user.findUniqueOrThrow({ where: { email: 'lea@example.com' } });

	if (await prisma.item.count()) {
		console.log('Items already exist, skipping inventory.');
		return;
	}

	const container = await prisma.container.create({ data: { name: 'Container' } });
	const boxes = await Promise.all(
		[
			// Positions in cm from the back-left floor corner (see the 3D map).
			{
				code: 'B-JUP1',
				label: 'Jupes flamenco',
				shelf: 'Étagère gauche, bas',
				posXCm: 0,
				posYCm: 0,
				posZCm: 0
			},
			{
				code: 'B-CHE1',
				label: 'Chemises homme',
				shelf: 'Étagère gauche, haut',
				posXCm: 0,
				posYCm: 0,
				posZCm: 120
			},
			{
				code: 'B-ROB1',
				label: 'Robes années 50',
				shelf: 'Fond, au sol',
				posXCm: 200,
				posYCm: 0,
				posZCm: 0
			},
			{
				code: 'B-ACC1',
				label: 'Accessoires (châles, ceintures)',
				shelf: 'Étagère droite, milieu',
				posXCm: 530,
				posYCm: 0,
				posZCm: 80
			},
			{
				code: 'B-CHA1',
				label: 'Chapeaux',
				shelf: 'Étagère droite, haut',
				posXCm: 530,
				posYCm: 0,
				posZCm: 160
			}
		].map((box) =>
			prisma.box.create({
				data: { ...box, widthCm: 60, depthCm: 40, heightCm: 40, containerId: container.id }
			})
		)
	);
	const [skirts, shirts, dresses, accessories, hats] = boxes;

	const pieces: {
		name: string;
		category: ItemCategory;
		color: string;
		sizes: string[];
		box: (typeof boxes)[number];
		tags: string[];
		description?: string;
	}[] = [
		{
			name: 'Jupe flamenco rouge à volants',
			category: 'SKIRT',
			color: 'Rouge',
			sizes: ['36', '38', '38', '40', '42'],
			box: skirts,
			tags: ['flamenco', 'volants'],
			description: 'Jupe longue à trois volants, pois blancs.'
		},
		{
			name: 'Jupe flamenco noire',
			category: 'SKIRT',
			color: 'Noir',
			sizes: ['36', '38', '40'],
			box: skirts,
			tags: ['flamenco']
		},
		{
			name: 'Chemise blanche à jabot',
			category: 'SHIRT',
			color: 'Blanc',
			sizes: ['M', 'L', 'L', 'XL'],
			box: shirts,
			tags: ['homme', 'classique']
		},
		{
			name: 'Robe swing à pois bleue',
			category: 'DRESS',
			color: 'Bleu',
			sizes: ['S', 'M'],
			box: dresses,
			tags: ['années 50', 'rock', 'pois']
		},
		{
			name: 'Robe vichy rose',
			category: 'DRESS',
			color: 'Rose',
			sizes: ['M'],
			box: dresses,
			tags: ['années 50', 'rock']
		},
		{
			name: 'Châle brodé à franges',
			category: 'SCARF',
			color: 'Noir',
			sizes: ['Unique', 'Unique'],
			box: accessories,
			tags: ['flamenco', 'franges']
		},
		{
			name: 'Chapeau cordobés',
			category: 'HAT',
			color: 'Noir',
			sizes: ['57', '58'],
			box: hats,
			tags: ['flamenco', 'homme']
		}
	];

	let counter = 0;
	const created: string[] = [];
	for (const piece of pieces) {
		for (const size of piece.sizes) {
			counter++;
			const item = await prisma.item.create({
				data: {
					code: `DEMO${String(counter).padStart(2, '0')}`,
					name: piece.name,
					description: piece.description,
					category: piece.category,
					color: piece.color,
					size,
					boxId: piece.box.id,
					tags: {
						create: piece.tags.map((name) => ({
							tag: { connectOrCreate: { where: { name }, create: { name } } }
						}))
					},
					movements: {
						create: [
							{ type: 'CREATED', userId: alice.id },
							{ type: 'STORED', toBoxId: piece.box.id, userId: alice.id }
						]
					}
				}
			});
			created.push(item.id);
		}
	}

	// A few loans: two for an upcoming show, one overdue.
	const lend = async (
		itemId: string,
		borrower: { userId?: string; name?: string },
		dueInDays: number
	) => {
		const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
		const loan = await prisma.loan.create({
			data: {
				itemId,
				borrowerUserId: borrower.userId,
				borrowerName: borrower.name,
				reason: 'Gala de printemps',
				checkedOutAt: new Date(Date.now() - 20 * DAY),
				dueAt: new Date(Date.now() + dueInDays * DAY),
				createdById: alice.id
			}
		});
		await prisma.item.update({ where: { id: itemId }, data: { boxId: null } });
		await prisma.movement.create({
			data: {
				itemId,
				type: 'CHECKED_OUT',
				fromBoxId: item.boxId,
				loanId: loan.id,
				userId: alice.id,
				createdAt: loan.checkedOutAt
			}
		});
	};
	await lend(created[0], { userId: lea.id }, 5);
	await lend(created[10], { userId: lea.id }, 5);
	await lend(created[13], { name: 'Sofia (stagiaire)' }, -3);

	await prisma.item.update({ where: { id: created[3] }, data: { condition: 'TO_REPAIR' } });

	console.log(`Seeded ${created.length} items in ${boxes.length} boxes.`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
