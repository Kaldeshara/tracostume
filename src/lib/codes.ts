import { randomInt } from 'node:crypto';

// No 0/O, 1/I/L or 5/S, so codes can be read and typed from a printed label.
const ALPHABET = '2346789ABCDEFGHJKMNPQRTUVWXYZ';

export function randomCode(length: number) {
	let code = '';
	for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
	return code;
}

export { parseScannedCode } from './scan-code';
