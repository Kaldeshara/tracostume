import { describe, expect, it } from 'vitest';
import { hasBackButton, parentPath } from './back.svelte';

describe('back button', () => {
	it('shows on detail pages only', () => {
		expect(hasBackButton('/items')).toBe(false);
		expect(hasBackButton('/')).toBe(false);
		expect(hasBackButton('/items/abc')).toBe(true);
		expect(hasBackButton('/items/abc/edit')).toBe(true);
	});

	it('falls back to the parent page', () => {
		expect(parentPath('/items/abc/edit')).toBe('/items/abc');
		expect(parentPath('/boxes/abc')).toBe('/boxes');
	});
});
