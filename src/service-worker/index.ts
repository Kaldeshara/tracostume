import { self } from '$app/service-worker';
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

// Caches only the app shell (hashed JS/CSS and static files) so the installed app starts fast.
// Pages, data and photos always come from the network: stock information must never be stale,
// and everything behind the login is private.

const CACHE = `tracostume-${version}`;
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
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
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
