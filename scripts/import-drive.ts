import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { randomCode } from '../src/lib/codes';

// One-off import of the association's Google Drive inventory (see data/import/README.md).
//
//   npx tsx scripts/import-drive.ts            # import (refuses to run twice)
//   npx tsx scripts/import-drive.ts --reset    # delete a previous import first
//
// Input: data/import/drive-inventory.json (from the parser) and data/import/photos/<driveId>.jpg
// (downloaded and shrunk beforehand). Each counted piece becomes its own item with its own code;
// identical pieces share one stored photo (storage key drive/<driveId>.jpg).

type Record_ = {
	category: string;
	name: string;
	quantity: number | null;
	colors: string[];
	note: string;
	drive_folder: string;
	drive_file: string;
	drive_id: string;
};

const IMPORT_DIR = path.resolve('data/import');
const PHOTO_DIR = path.join(IMPORT_DIR, 'photos');
const STORAGE_PREFIX = 'drive/';
const UPLOADS_DIR = process.env.UPLOADS_DIR?.trim() || './data/uploads';

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

// Same storage rule as src/lib/server/storage.ts: the bucket when configured, else local disk.
function s3() {
	const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL, AWS_S3_BUCKET_NAME } =
		process.env;
	if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_ENDPOINT_URL || !AWS_S3_BUCKET_NAME)
		return null;
	return {
		bucket: AWS_S3_BUCKET_NAME,
		client: new S3Client({
			region: process.env.AWS_DEFAULT_REGION?.trim() || 'auto',
			endpoint: AWS_ENDPOINT_URL,
			credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
			forcePathStyle: process.env.AWS_S3_URL_STYLE?.trim().toLowerCase() === 'path',
			requestChecksumCalculation: 'WHEN_REQUIRED',
			responseChecksumValidation: 'WHEN_REQUIRED'
		})
	};
}
const bucket = s3();

async function putObject(key: string, body: Buffer) {
	if (bucket) {
		await bucket.client.send(
			new PutObjectCommand({
				Bucket: bucket.bucket,
				Key: key,
				Body: body,
				ContentType: 'image/jpeg'
			})
		);
		return;
	}
	const file = path.resolve(UPLOADS_DIR, key);
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, body);
}

async function uniqueItemCode() {
	for (;;) {
		const code = randomCode(6);
		if (!(await prisma.item.findUnique({ where: { code }, select: { id: true } }))) return code;
	}
}

function describe(record: Record_) {
	const lines = [`Importé du Drive : ${record.drive_folder || '(racine)'}/${record.drive_file}`];
	if (record.note.includes('whole box'))
		lines.push('Photo de la caisse entière, nombre de pièces inconnu.');
	else if (record.note.includes('assorted')) lines.push('Lot de pièces diverses, nombre inconnu.');
	else if (record.note.includes('quantity unknown'))
		lines.push('Quantité non indiquée dans le Drive.');
	return lines.join('\n');
}

async function main() {
	const reset = process.argv.includes('--reset');
	const records: Record_[] = JSON.parse(
		await readFile(path.join(IMPORT_DIR, 'drive-inventory.json'), 'utf8')
	);

	const missing = [...new Set(records.map((r) => r.drive_id))].filter(
		(id) => !existsSync(path.join(PHOTO_DIR, `${id}.jpg`))
	);
	if (missing.length) {
		throw new Error(`${missing.length} photos missing in ${PHOTO_DIR}; run the download first.`);
	}

	const previous = await prisma.itemPhoto.findMany({
		where: { storageKey: { startsWith: STORAGE_PREFIX } },
		select: { itemId: true },
		distinct: ['itemId']
	});
	if (previous.length) {
		if (!reset)
			throw new Error(`${previous.length} items already imported; use --reset to replace them.`);
		const { count } = await prisma.item.deleteMany({
			where: { id: { in: previous.map((p) => p.itemId) } }
		});
		console.log(`Deleted ${count} previously imported items.`);
	}

	const owner = await prisma.user.findFirst({
		where: { role: 'OWNER' },
		orderBy: { createdAt: 'asc' }
	});

	// Upload each photo once.
	const uploaded = new Set<string>();
	let itemCount = 0;
	for (const [index, record] of records.entries()) {
		const storageKey = `${STORAGE_PREFIX}${record.drive_id}.jpg`;
		if (!uploaded.has(storageKey)) {
			await putObject(storageKey, await readFile(path.join(PHOTO_DIR, `${record.drive_id}.jpg`)));
			uploaded.add(storageKey);
		}

		const pieces = record.quantity ?? 1;
		for (let n = 0; n < pieces; n++) {
			await prisma.item.create({
				data: {
					code: await uniqueItemCode(),
					name: record.name,
					category: record.category,
					color: record.colors.length ? record.colors.join(', ') : null,
					description: describe(record),
					photos: {
						create: {
							id: randomUUID(),
							storageKey,
							mimeType: 'image/jpeg',
							position: 0,
							uploadedById: owner?.id
						}
					},
					movements: { create: { type: 'CREATED', userId: owner?.id, note: 'Import Drive' } }
				}
			});
			itemCount++;
		}
		if ((index + 1) % 25 === 0)
			console.log(`${index + 1}/${records.length} entries, ${itemCount} items`);
	}
	console.log(
		`Imported ${itemCount} items from ${records.length} entries and ${uploaded.size} photos.`
	);
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
