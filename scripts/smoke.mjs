// CI smoke test: signs in with the seeded owner account, opens the main pages on a phone-sized
// screen, fails on any error status or page error, and saves a screenshot of each page.
// Usage: node scripts/smoke.mjs <base URL> <screenshot directory>
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const [base = 'http://localhost:5173', outDir = 'screenshots'] = process.argv.slice(2);
const PAGES = [
	'/',
	'/items',
	'/scan',
	'/selection',
	'/loans',
	'/lists',
	'/boxes',
	'/map',
	'/account',
	'/users'
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
const problems = [];
page.on('pageerror', (err) => problems.push(`${page.url()}: ${err.message}`));

await page.goto(`${base}/login`);
await page.fill('input[name="email"]', 'alice@example.com');
await page.fill('input[name="password"]', 'password123');
await Promise.all([page.waitForURL((url) => url.pathname === '/'), page.click('form button')]);

for (const path of PAGES) {
	const response = await page.goto(base + path, { waitUntil: 'networkidle' });
	const status = response?.status() ?? 0;
	if (status >= 400) problems.push(`${path}: HTTP ${status}`);
	const name = path === '/' ? 'home' : path.slice(1).replaceAll('/', '-');
	await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
	console.log(`${status} ${path}`);
}

// Create a show list and open it.
await page.goto(`${base}/lists`);
await page.getByRole('button', { name: /nouvelle liste/i }).click();
await page.fill('input[name="name"]', 'Gala de juin');
await Promise.all([
	page.waitForURL(/\/lists\/[^/]+$/),
	page.getByRole('button', { name: /enregistrer/i }).click()
]);
await page.screenshot({ path: `${outDir}/list.png`, fullPage: true });
console.log(`list created: ${page.url()}`);

await browser.close();
if (problems.length) {
	console.error(problems.join('\n'));
	process.exit(1);
}
