import { error, redirect } from '@sveltejs/kit';
import { sequence, type Handle, type ServerInit } from '@sveltejs/kit/hooks';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { getSessionUser } from '#lib/server/auth.ts';
import { canOpenPage } from '#lib/roles.ts';
import { warmUpSearch } from '#lib/server/embeddings.ts';
import { startReminders } from '#lib/server/reminders.ts';
import { building } from '$app/env';
import {
	htmlAttributes,
	parseSidebarCollapsed,
	parseThemePreference,
	SIDEBAR_COOKIE,
	THEME_COOKIE,
	themeHtml
} from '#lib/theme.ts';

const handleParaglide: Handle = ({ event, resolve }) => {
	// The theme is rendered on the server so the first paint already has the right colours.
	// Same for the desktop sidebar width, so the page does not jump on load.
	const preference = parseThemePreference(event.cookies.get(THEME_COOKIE));
	const attributes = htmlAttributes(
		preference,
		parseSidebarCollapsed(event.cookies.get(SIDEBAR_COOKIE))
	);
	const { themeColorMeta } = themeHtml(preference);
	return paraglideMiddleware(event.request, ({ request, locale }) => {
		return resolve(
			{ ...event, request },
			{
				transformPageChunk: ({ html }) =>
					html
						.replace('%paraglide.lang%', locale)
						.replace('%paraglide.dir%', getTextDirection(locale))
						.replace('%tracostume.theme%', attributes)
						.replace('%tracostume.themeColor%', themeColorMeta)
			}
		);
	});
};

// Everything is private except these pages (and static files, which never reach the hook).
const PUBLIC_PATHS = ['/login', '/register'];
const isPublic = (pathname: string) =>
	PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/reset/');

const handleAuth: Handle = async ({ event, resolve }) => {
	event.locals.user = await getSessionUser(event.cookies);

	const { pathname, search } = event.url;
	const user = event.locals.user;
	if (!user && !isPublic(pathname)) {
		redirect(303, `/login?next=${encodeURIComponent(pathname + search)}`);
	}
	if (user && !canOpenPage(user.role, pathname)) error(403, 'Forbidden');
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
