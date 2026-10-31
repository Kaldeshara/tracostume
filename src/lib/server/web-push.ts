import {
	createCipheriv,
	createECDH,
	createHmac,
	createPrivateKey,
	randomBytes,
	sign,
	type ECDH,
	type KeyObject
} from 'node:crypto';

// Web Push without a dependency: message encryption (RFC 8291, aes128gcm) and the VAPID
// signature (RFC 8292) with node:crypto. Keys are P-256, exchanged as base64url raw bytes.

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type VapidKeys = { publicKey: string; privateKey: string };

const b64 = (value: string) => Buffer.from(value, 'base64url');
const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest();
const RECORD_SIZE = 4096;

/** A new VAPID key pair (the public key is what browsers subscribe with). */
export function generateVapidKeys(): VapidKeys {
	const ecdh = createECDH('prime256v1');
	ecdh.generateKeys();
	return {
		publicKey: ecdh.getPublicKey().toString('base64url'),
		privateKey: ecdh.getPrivateKey().toString('base64url')
	};
}

function vapidPrivateKey({ publicKey, privateKey }: VapidKeys): KeyObject {
	const raw = b64(publicKey);
	return createPrivateKey({
		format: 'jwk',
		key: {
			kty: 'EC',
			crv: 'P-256',
			x: raw.subarray(1, 33).toString('base64url'),
			y: raw.subarray(33, 65).toString('base64url'),
			d: privateKey
		}
	});
}

/** `Authorization` header value proving the message comes from this server (RFC 8292). */
export function vapidAuthorization(
	endpoint: string,
	keys: VapidKeys,
	subject: string,
	now = Date.now()
) {
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
	const unsigned = `${encode({ typ: 'JWT', alg: 'ES256' })}.${encode({
		aud: new URL(endpoint).origin,
		exp: Math.floor(now / 1000) + 12 * 3600,
		sub: subject
	})}`;
	const signature = sign('sha256', Buffer.from(unsigned), {
		key: vapidPrivateKey(keys),
		dsaEncoding: 'ieee-p1363'
	});
	return `vapid t=${unsigned}.${signature.toString('base64url')}, k=${keys.publicKey}`;
}

/** Encrypts a message for one subscription (RFC 8291, single aes128gcm record). */
export function encryptPayload(
	target: Pick<PushTarget, 'p256dh' | 'auth'>,
	payload: string,
	salt = randomBytes(16),
	serverKeys?: ECDH
) {
	if (!serverKeys) {
		serverKeys = createECDH('prime256v1');
		serverKeys.generateKeys();
	}
	const uaPublic = b64(target.p256dh);
	const asPublic = serverKeys.getPublicKey();
	const ecdhSecret = serverKeys.computeSecret(uaPublic);

	const prkKey = hmac(b64(target.auth), ecdhSecret);
	const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
	const ikm = hmac(prkKey, Buffer.concat([keyInfo, Buffer.from([1])]));
	const prk = hmac(salt, ikm);
	const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
	const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);

	// The plaintext ends with the 0x02 delimiter of the last (only) record.
	const plaintext = Buffer.concat([Buffer.from(payload), Buffer.from([2])]);
	if (plaintext.length + 16 > RECORD_SIZE) throw new Error('Push payload too long');
	const cipher = createCipheriv('aes-128-gcm', cek, nonce);
	const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

	const header = Buffer.alloc(21);
	salt.copy(header, 0);
	header.writeUInt32BE(RECORD_SIZE, 16);
	header.writeUInt8(asPublic.length, 20);
	return Buffer.concat([header, asPublic, ciphertext]);
}

/**
 * Sends one notification. Returns the push service status: 201 when accepted, 404/410 when the
 * subscription no longer exists (it should then be deleted).
 */
export async function sendPush(
	target: PushTarget,
	payload: object,
	keys: VapidKeys,
	subject: string
) {
	const response = await fetch(target.endpoint, {
		method: 'POST',
		headers: {
			Authorization: vapidAuthorization(target.endpoint, keys, subject),
			'Content-Encoding': 'aes128gcm',
			'Content-Type': 'application/octet-stream',
			TTL: String(24 * 3600),
			Urgency: 'normal'
		},
		body: encryptPayload(target, JSON.stringify(payload))
	});
	return response.status;
}
