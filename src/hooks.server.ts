import { error, redirect } from '@sveltejs/kit';
import type { UserRole } from './generated/prisma/enums';
import { sequence, type Handle, type ServerInit } from '@sveltejs/kit/hooks';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { getSessionUser } from '#lib/server/auth.ts';
import { canManageStock, canManageUsers, canSeeContainer, canSeeLists } from '#lib/roles.ts';
import { warmUpSearch } from '#lib/server/embeddings.ts';
import { startReminders } from '#lib/server/reminders.ts';
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
const isPublic = (pathname: string) =>
	PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/reset/');

// Pages reserved to some roles; everything else is open to every signed-in member.
const RESTRICTED: [prefix: string, allowed: (role: UserRole) => boolean][] = [
	['/users', canManageUsers],
	['/container', canManageUsers],
	['/labels', canManageStock],
	['/items/new', canManageStock],
	['/boxes', canSeeContainer],
	['/map', canSeeContainer],
	['/lists', canSeeLists]
];
const EDIT_ITEM = /^\/items\/[^/]+\/edit$/;

const handleAuth: Handle = async ({ event, resolve }) => {
	event.locals.user = await getSessionUser(event.cookies);

	const { pathname, search } = event.url;
	const user = event.locals.user;
	if (!user && !isPublic(pathname)) {
		redirect(303, `/login?next=${encodeURIComponent(pathname + search)}`);
	}
	if (user) {
		const rule = RESTRICTED.find(
			([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/')
		);
		if ((rule && !rule[1](user.role)) || (EDIT_ITEM.test(pathname) && !canManageStock(user.role))) {
			error(403, 'Forbidden');
		}
	}
	return resolve(event);
};

export const handle = sequence(handleAuth, handleParaglide);

// Load the search model and index the catalogue at start, so the first search is not slow.
// Start the daily loan reminders (Web Push).
export const init: ServerInit = async () => {
	if (building) return;
	warmUpSearch();
	startReminders();
};
