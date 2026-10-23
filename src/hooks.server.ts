import { redirect } from '@sveltejs/kit';
import { sequence, type Handle, type ServerInit } from '@sveltejs/kit/hooks';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { getSessionUser } from '#lib/server/auth.ts';
import { warmUpSearch } from '#lib/server/embeddings.ts';
import { building } from '$app/env';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		return resolve(
			{ ...event, request },
			{
				transformPageChunk: ({ html }) =>
					html
						.replace('%paraglide.lang%', locale)
						.replace('%paraglide.dir%', getTextDirection(locale))
			}
		);
	});

// Everything is private except these pages (and static files, which never reach the hook).
const PUBLIC_PATHS = ['/login', '/register'];

const handleAuth: Handle = async ({ event, resolve }) => {
	event.locals.user = await getSessionUser(event.cookies);

	const { pathname, search } = event.url;
	if (!event.locals.user && !PUBLIC_PATHS.includes(pathname)) {
		redirect(303, `/login?next=${encodeURIComponent(pathname + search)}`);
	}
	return resolve(event);
};

export const handle = sequence(handleAuth, handleParaglide);

// Load the search model and index the catalogue at start, so the first search is not slow.
export const init: ServerInit = async () => {
	if (!building) warmUpSearch();
};
