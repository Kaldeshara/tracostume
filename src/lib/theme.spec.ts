import { describe, expect, it } from 'vitest';
import {
	htmlAttributes,
	isAutumnSeason,
	parseSidebarCollapsed,
	parseThemePreference,
	seasonalTheme,
	themeHtml
} from './theme';

describe('parseThemePreference', () => {
	it('keeps an explicit choice and falls back to the device', () => {
		expect(parseThemePreference('dark')).toBe('dark');
		expect(parseThemePreference('light')).toBe('light');
		expect(parseThemePreference(undefined)).toBe('system');
		expect(parseThemePreference('purple')).toBe('system');
	});
});

describe('autumn season', () => {
	it('runs from 15 October to 30 November', () => {
		expect(isAutumnSeason(new Date(2026, 9, 14))).toBe(false);
		expect(isAutumnSeason(new Date(2026, 9, 15))).toBe(true);
		expect(isAutumnSeason(new Date(2026, 10, 30))).toBe(true);
		expect(isAutumnSeason(new Date(2026, 11, 1))).toBe(false);
	});

	it('can be turned off on the device', () => {
		const november = new Date(2026, 10, 13);
		expect(seasonalTheme(november, undefined)).toBe('autumn');
		expect(seasonalTheme(november, 'off')).toBeNull();
		expect(seasonalTheme(new Date(2026, 5, 1), undefined)).toBeNull();
	});
});

describe('themeHtml', () => {
	it('sets data-theme only for an explicit choice', () => {
		expect(themeHtml('system').attribute).toBe('');
		expect(themeHtml('dark').attribute).toBe('data-theme="dark"');
	});

	it('gives both status-bar colours when following the device', () => {
		expect(themeHtml('system').themeColorMeta.match(/<meta/g)).toHaveLength(2);
		expect(themeHtml('dark').themeColorMeta).toContain('#1c1917');
	});
});

describe('sidebar state', () => {
	it('is expanded unless collapsed on the device', () => {
		expect(parseSidebarCollapsed('collapsed')).toBe(true);
		expect(parseSidebarCollapsed('expanded')).toBe(false);
		expect(parseSidebarCollapsed(undefined)).toBe(false);
	});

	it('renders theme and sidebar on <html>', () => {
		expect(htmlAttributes('system', false)).toBe('');
		expect(htmlAttributes('dark', true)).toBe('data-theme="dark" data-sidebar="collapsed"');
	});
});
