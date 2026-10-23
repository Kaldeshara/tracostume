import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import {
	AWS_ACCESS_KEY_ID,
	AWS_DEFAULT_REGION,
	AWS_ENDPOINT_URL,
	AWS_S3_BUCKET_NAME,
	AWS_S3_URL_STYLE,
	AWS_SECRET_ACCESS_KEY,
	UPLOADS_DIR
} from '$app/env/private';

// Photos go to the S3 bucket when it is configured (production on Railway),
// otherwise to the local disk (development).

const KEY_PATTERN = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9._-]+)*$/;

let client: S3Client | undefined;

function getS3() {
	if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_ENDPOINT_URL || !AWS_S3_BUCKET_NAME) {
		return null;
	}
	client ??= new S3Client({
		region: AWS_DEFAULT_REGION,
		endpoint: AWS_ENDPOINT_URL,
		credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
		forcePathStyle: AWS_S3_URL_STYLE === 'path',
		requestChecksumCalculation: 'WHEN_REQUIRED',
		responseChecksumValidation: 'WHEN_REQUIRED'
	});
	return { client, bucket: AWS_S3_BUCKET_NAME };
}

function localPath(key: string) {
	if (!KEY_PATTERN.test(key) || key.includes('..')) {
		throw new Error(`Invalid storage key: ${key}`);
	}
	return path.resolve(UPLOADS_DIR, key);
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
	const s3 = getS3();
	if (s3) {
		await s3.client.send(
			new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: body, ContentType: contentType })
		);
		return;
	}
	const file = localPath(key);
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, body);
}

export async function getObject(key: string): Promise<Uint8Array | ReadableStream | null> {
	const s3 = getS3();
	if (s3) {
		try {
			const response = await s3.client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: key }));
			return response.Body?.transformToWebStream() ?? null;
		} catch (err) {
			if ((err as { name?: string }).name === 'NoSuchKey') return null;
			throw err;
		}
	}
	try {
		return await readFile(localPath(key));
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw err;
	}
}

export async function deleteObject(key: string) {
	const s3 = getS3();
	if (s3) {
		await s3.client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key }));
		return;
	}
	await rm(localPath(key), { force: true });
}
