// Browser-safe (no node:crypto): also used by the scanner to look codes up offline.

/** Accepts a raw code or a scanned QR URL (…/q/<code>) and returns the normalized code. */
export function parseScannedCode(value: string) {
	const trimmed = value.trim();
	const match = trimmed.match(/\/q\/([A-Za-z0-9-]+)\/?$/);
	return (match ? match[1] : trimmed).toUpperCase();
}
