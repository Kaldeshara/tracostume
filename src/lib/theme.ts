// Per-device appearance, stored in cookies so the server renders the right theme on first paint
// (same scheme as Tracster). "system" follows the device's light/dark setting.

export type ThemePreference = 'system' | 'light' | 'dark';
export type SeasonalTheme = 'autumn';

export const THEME_COOKIE = 'tracostume_theme';
export const SEASONAL_COOKIE = 'tracostume_seasonal';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const LIGHT_THEME_COLOR = '#ffffff';
export const DARK_THEME_COLOR = '#1c1917';

export function parseThemePreference(value: string | undefined): ThemePreference {
	return value === 'light' || value === 'dark' ? value : 'system';
}

/** 15 October – 30 November (local calendar), as in Tracster. */
export function isAutumnSeason(date: Date): boolean {
	const month = date.getMonth();
	return (month === 9 && date.getDate() >= 15) || month === 10;
}

export function seasonalTheme(
	date: Date,
	seasonalCookie: string | undefined
): SeasonalTheme | null {
	if (seasonalCookie === 'off') return null;
	return isAutumnSeason(date) ? 'autumn' : null;
}

/** `<html>` attribute and status-bar colour for the server-rendered page. */
export function themeHtml(preference: ThemePreference) {
	const meta = (color: string, media?: string) =>
		`<meta name="theme-color" content="${color}"${media ? ` media="${media}"` : ''} />`;
	return {
		attribute: preference === 'system' ? '' : `data-theme="${preference}"`,
		themeColorMeta:
			preference === 'system'
				? meta(LIGHT_THEME_COLOR, '(prefers-color-scheme: light)') +
					meta(DARK_THEME_COLOR, '(prefers-color-scheme: dark)')
				: meta(preference === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR)
	};
}

function setCookie(name: string, value: string) {
	document.cookie = `${name}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

/** Browser only: remember the choice and apply it to the page right away. */
export function applyThemePreference(preference: ThemePreference) {
	setCookie(THEME_COOKIE, preference);
	const root = document.documentElement;
	if (preference === 'system') delete root.dataset.theme;
	else root.dataset.theme = preference;
	const dark =
		preference === 'dark' ||
		(preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
		meta.removeAttribute('media');
		meta.content = dark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
	}
}

/** Browser only: the caller re-runs the layout load to show or hide the decoration. */
export function rememberSeasonalStyle(enabled: boolean) {
	setCookie(SEASONAL_COOKIE, enabled ? 'on' : 'off');
}

/** Desktop sidebar collapsed into its icon rail (per device), as in Tracster. */
export const SIDEBAR_COOKIE = 'tracostume_sidebar';

export function parseSidebarCollapsed(value: string | undefined): boolean {
	return value === 'collapsed';
}

/** `<html>` attributes for the server-rendered page: theme and sidebar state. */
export function htmlAttributes(preference: ThemePreference, sidebarCollapsed: boolean): string {
	return [themeHtml(preference).attribute, sidebarCollapsed ? 'data-sidebar="collapsed"' : '']
		.filter(Boolean)
		.join(' ');
}

/** Browser only: remember the choice and apply it right away (`data-sidebar` on <html>). */
export function applySidebarCollapsed(collapsed: boolean) {
	setCookie(SIDEBAR_COOKIE, collapsed ? 'collapsed' : 'expanded');
	if (collapsed) document.documentElement.dataset.sidebar = 'collapsed';
	else delete document.documentElement.dataset.sidebar;
}
