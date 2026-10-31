import { createDecipheriv, createECDH, createHmac, createPublicKey, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { encryptPayload, generateVapidKeys, vapidAuthorization } from './web-push';

const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest();

/** What the browser does on receipt (RFC 8291), to check the server side round-trips. */
function decrypt(body: Buffer, ua: ReturnType<typeof createECDH>, auth: Buffer) {
	const salt = body.subarray(0, 16);
	const idLength = body.readUInt8(20);
	const asPublic = body.subarray(21, 21 + idLength);
	const ciphertext = body.subarray(21 + idLength);

	const prkKey = hmac(auth, ua.computeSecret(asPublic));
	const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic]);
	const ikm = hmac(prkKey, Buffer.concat([keyInfo, Buffer.from([1])]));
	const prk = hmac(salt, ikm);
	const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
	const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);

	const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
	decipher.setAuthTag(ciphertext.subarray(-16));
	return Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]);
}

describe('web push', () => {
	it('encrypts a payload the subscriber can decrypt', () => {
		const ua = createECDH('prime256v1');
		ua.generateKeys();
		const auth = Buffer.from('0123456789abcdef');
		const body = encryptPayload(
			{ p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
			'{"title":"Bonjour"}'
		);
		expect(body.readUInt32BE(16)).toBe(4096);
		const plaintext = decrypt(body, ua, auth);
		expect(plaintext.at(-1)).toBe(2);
		expect(plaintext.subarray(0, -1).toString()).toBe('{"title":"Bonjour"}');
	});

	it('signs a VAPID token for the push service origin', () => {
		const keys = generateVapidKeys();
		const header = vapidAuthorization(
			'https://push.example.net/send/abc',
			keys,
			'mailto:admin@example.com',
			Date.UTC(2026, 10, 1)
		);
		const match = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
		expect(match).not.toBeNull();
		const [, head, claims, signature, k] = match!;
		expect(k).toBe(keys.publicKey);
		expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toMatchObject({
			aud: 'https://push.example.net',
			sub: 'mailto:admin@example.com'
		});

		const raw = Buffer.from(keys.publicKey, 'base64url');
		const publicKey = createPublicKey({
			format: 'jwk',
			key: {
				kty: 'EC',
				crv: 'P-256',
				x: raw.subarray(1, 33).toString('base64url'),
				y: raw.subarray(33, 65).toString('base64url')
			}
		});
		const valid = verify(
			'sha256',
			Buffer.from(`${head}.${claims}`),
			{ key: publicKey, dsaEncoding: 'ieee-p1363' },
			Buffer.from(signature, 'base64url')
		);
		expect(valid).toBe(true);
	});
});
