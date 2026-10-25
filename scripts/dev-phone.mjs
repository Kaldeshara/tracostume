import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';

// `npm run dev:phone`: starts the dev server over HTTPS on the local network and prints a QR code
// of its address, to scan with the phone (same Wi-Fi). The certificate is self-signed: accept the
// browser warning once. Under WSL, mirrored networking is needed (see README).

const PORT = process.env.PORT || '5173';
const address = Object.values(networkInterfaces())
	.flat()
	.find(
		(net) => net && net.family === 'IPv4' && !net.internal && !net.address.startsWith('10.255.')
	);
const url = `https://${address?.address ?? 'localhost'}:${PORT}`;

console.log(`\nOn the phone, scan this or open ${url}\n`);
console.log(await QRCode.toString(url, { type: 'terminal', small: true }));

const vite = spawn('npx', ['vite', 'dev', '--host', '--port', PORT, '--strictPort'], {
	stdio: 'inherit',
	env: { ...process.env, DEV_HTTPS: '1' }
});
vite.on('exit', (code) => process.exit(code ?? 0));
