import { self } from '$app/service-worker';
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

// Caches the app shell (hashed JS/CSS and static files) so the installed app starts fast.
// Pages, data and photos come from the network: stock information must never be stale, and
// everything behind the login is private. One exception: the scanner page is also kept (network
// first) so it opens without a connection inside the container; see #lib/offline-scan.svelte.ts.
// The app deletes that copy when the member signs out.

const CACHE = `tracostume-${version}`;
const PAGES = 'tracostume-pages';
// The scanner page and its data requests; not its lookup and catalogue endpoints.
const isOfflinePage = (pathname: string) =>
	pathname === '/scan' ||
	(pathname.startsWith('/scan/') && !['/scan/lookup', '/scan/catalogue'].includes(pathname));
const PRECACHE = [...immutable, ...assets].map((file) => file.path);
const CACHED = new Set(PRECACHE);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key !== CACHE && key !== PAGES)
						.map((key) => caches.delete(key))
				)
			)
			.then(() => self.clients.claim())
	);
});

async function networkFirst(request: Request, key: string) {
	const cache = await caches.open(PAGES);
	try {
		const response = await fetch(request);
		if (response.ok && !response.redirected) await cache.put(key, response.clone());
		return response;
	} catch (err) {
		const cached = await cache.match(key);
		if (cached) return cached;
		throw err;
	}
}

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (
		event.request.method === 'GET' &&
		url.origin === self.location.origin &&
		isOfflinePage(url.pathname)
	) {
		// Navigations and data requests to the same page are cached apart.
		const key = `${url.pathname}?offline=${event.request.mode === 'navigate' ? 'page' : 'data'}`;
		event.respondWith(networkFirst(event.request, key));
		return;
	}
	if (
		event.request.method !== 'GET' ||
		url.origin !== self.location.origin ||
		!CACHED.has(url.pathname)
	) {
		return;
	}
	event.respondWith(
		caches
			.open(CACHE)
			.then(async (cache) => (await cache.match(url.pathname)) ?? fetch(event.request))
	);
});
