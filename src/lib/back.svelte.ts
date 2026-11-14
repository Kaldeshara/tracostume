// Whether the current page was reached by navigating inside the app (so "back" can use the
// browser history) rather than opened directly from a link or a QR code.
export const cameFromApp = $state({ value: false });

/** Parent page for the back button: the path without its last segment ("/items/x/edit" → "/items/x"). */
export function parentPath(pathname: string): string {
	const segments = pathname.split('/').filter(Boolean);
	return '/' + segments.slice(0, -1).join('/');
}

/** Detail pages (two segments or more) get a back button; navigation destinations do not. */
export function hasBackButton(pathname: string): boolean {
	return pathname.split('/').filter(Boolean).length >= 2;
}
