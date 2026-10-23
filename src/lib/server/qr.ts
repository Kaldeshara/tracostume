import QRCode from 'qrcode';

export function qrUrl(origin: string, code: string) {
	return `${origin}/q/${encodeURIComponent(code)}`;
}

export function qrSvg(origin: string, code: string) {
	return QRCode.toString(qrUrl(origin, code), {
		type: 'svg',
		margin: 1,
		errorCorrectionLevel: 'M'
	});
}
