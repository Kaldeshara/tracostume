import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

// Applies the descriptive tags of data/import/tags.json (name → "tag, tag, …") to every item with
// that name. Existing tags are kept; tags listed in the file are added. Safe to run again.
//
//   npx tsx scripts/enrich-tags.ts

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

async function main() {
	const file = JSON.parse(await readFile('data/import/tags.json', 'utf8')) as Record<
		string,
		string
	>;
	const entries = Object.entries(file).filter(([name]) => !name.startsWith('_'));

	let itemsTagged = 0;
	let tagLinks = 0;
	const unknownNames: string[] = [];
	for (const [name, tagList] of entries) {
		const tags = [...new Set(tagList.split(',').map((tag) => tag.trim().toLowerCase()))].filter(
			Boolean
		);
		const items = await prisma.item.findMany({ where: { name }, select: { id: true } });
		if (!items.length) {
			unknownNames.push(name);
			continue;
		}
		for (const tag of tags) {
			const { id: tagId } = await prisma.tag.upsert({
				where: { name: tag },
				update: {},
				create: { name: tag },
				select: { id: true }
			});
			const { count } = await prisma.itemTag.createMany({
				data: items.map((item) => ({ itemId: item.id, tagId })),
				skipDuplicates: true
			});
			tagLinks += count;
		}
		itemsTagged += items.length;
	}

	const untagged = await prisma.item.findMany({
		where: { tags: { none: {} } },
		select: { name: true },
		distinct: ['name']
	});
	console.log(`Tagged ${itemsTagged} items (${tagLinks} new links).`);
	if (unknownNames.length)
		console.log(`Names in tags.json with no item: ${unknownNames.join(' | ')}`);
	if (untagged.length)
		console.log(`Items still without tags: ${untagged.map((u) => u.name).join(' | ')}`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
