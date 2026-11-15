<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { afterNavigate, invalidate } from '$app/navigation';
	import { PUBLIC_APP_NAME } from '$app/env/public';
	import { m } from '#lib/paraglide/messages.js';
	import {
		canManageStock,
		canManageUsers,
		canOpenPage,
		canSeeContainer,
		canSeeLists
	} from '#lib/roles.ts';
	import { selection } from '#lib/selection.svelte.ts';
	import { offlineScan } from '#lib/offline-scan.svelte.ts';
	import { roleLabel } from '#lib/format.ts';
	import LanguageSwitcher from '#lib/components/LanguageSwitcher.svelte';
	import NavIcon, { type NavIconName } from '#lib/components/NavIcon.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import AutumnAccent from '#lib/components/AutumnAccent.svelte';
	import ChristmasLights from '#lib/components/ChristmasLights.svelte';
	import AppSidebar from '#lib/components/AppSidebar.svelte';
	import BackButton from '#lib/components/BackButton.svelte';
	import { cameFromApp, hasBackButton, parentPath } from '#lib/back.svelte.ts';
	import { rememberSeasonalStyle } from '#lib/theme.ts';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	type NavLink = { href: string; label: string; icon: NavIconName; badge?: number };

	const user = $derived(data.user);
	// Header, tab bar, sidebar and page background follow the season, as in Tracster.
	const SEASON_CLASSES = {
		autumn: { bar: 'autumn-header border-amber-300/80', surface: 'autumn-surface' },
		christmas: { bar: 'festive-header border-red-200/80', surface: 'festive-surface' }
	} as const;
	const seasonClasses = $derived(data.season ? SEASON_CLASSES[data.season] : null);
	const barClass = $derived(seasonClasses?.bar ?? 'border-stone-200 bg-white/95');

	function toggleSeasonalStyle(event: Event & { currentTarget: HTMLInputElement }) {
		rememberSeasonalStyle(event.currentTarget.checked);
		invalidate('app:appearance');
	}
	let menuOpen = $state(false);

	const tabs: NavLink[] = $derived([
		{ href: '/', label: m.nav_home(), icon: 'home' },
		{ href: '/items', label: m.nav_gallery(), icon: 'gallery' },
		{ href: '/scan', label: m.nav_scan(), icon: 'scan' },
		{ href: '/loans', label: m.nav_loans(), icon: 'loans', badge: data.overdueCount },
		...(canSeeContainer(user?.role)
			? [{ href: '/boxes', label: m.nav_boxes(), icon: 'boxes' as const }]
			: [])
	]);
	const centerTabHref = '/scan';

	const menuLinks: NavLink[] = $derived([
		...(canSeeContainer(user?.role)
			? [{ href: '/map', label: m.nav_map(), icon: 'map' as const }]
			: []),
		...(canSeeLists(user?.role)
			? [{ href: '/lists', label: m.nav_lists(), icon: 'lists' as const }]
			: []),
		...(canManageStock(user?.role)
			? [{ href: '/labels', label: m.nav_labels(), icon: 'labels' as const }]
			: []),
		...(canManageUsers(user?.role)
			? [
					{ href: '/users', label: m.nav_users(), icon: 'users' as const },
					{ href: '/container', label: m.nav_container(), icon: 'container' as const }
				]
			: []),
		{ href: '/account', label: m.nav_account(), icon: 'account' }
	]);

	// Desktop sidebar: the tabs, the 3D map and the lists, then the management pages.
	const SIDEBAR_MAIN_EXTRAS = ['/map', '/lists'];
	const sidebarMainLinks: NavLink[] = $derived([
		...tabs,
		...menuLinks.filter((link) => SIDEBAR_MAIN_EXTRAS.includes(link.href))
	]);
	const sidebarManagementLinks: NavLink[] = $derived(
		menuLinks.filter((link) => !SIDEBAR_MAIN_EXTRAS.includes(link.href) && link.href !== '/account')
	);

	// Signing out forgets the scanner's offline copy (pieces, page) kept on this phone.
	function signOut(event: SubmitEvent) {
		if (offlineScan.pending.length && !confirm(m.scan_offline_logout_confirm())) {
			event.preventDefault();
			return;
		}
		offlineScan.clear();
		globalThis.caches?.delete('tracostume-pages').catch(() => {});
	}

	// From a scanned label, "back" goes to the parent page, or home when that page is closed to the
	// member (a dancer may open a unit but not the list of units).
	const backTarget = $derived.by(() => {
		const parent = parentPath(page.url.pathname);
		return canOpenPage(user?.role, parent) ? parent : '/';
	});

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);

	const initials = (firstName: string, lastName?: string | null) =>
		[firstName, lastName]
			.map((part) => part?.trim()[0] ?? '')
			.join('')
			.toLocaleUpperCase() || '?';

	// The back button uses the history only after a navigation inside the app.
	afterNavigate(({ from }) => {
		cameFromApp.value = from !== null;
	});

	// Any navigation closes the menu.
	$effect(() => {
		void page.url.pathname;
		menuOpen = false;
	});

	// Lock the viewport scroller (<html>, which clips overflow-x) while the menu is open.
	$effect(() => {
		if (!menuOpen) return;
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') menuOpen = false;
		};
		document.documentElement.style.overflow = 'hidden';
		window.addEventListener('keydown', closeOnEscape);
		return () => {
			document.documentElement.style.overflow = '';
			window.removeEventListener('keydown', closeOnEscape);
		};
	});
</script>

<svelte:head>
	<title>{PUBLIC_APP_NAME}</title>
</svelte:head>

<div
	class="flex min-h-dvh flex-col text-stone-900 {seasonClasses?.surface ?? 'bg-stone-50'} {user
		? 'app-frame'
		: ''}"
>
	{#if user}
		<AppSidebar
			user={{ name: user.name, role: user.role }}
			mainLinks={sidebarMainLinks}
			managementLinks={sidebarManagementLinks}
			newItemHref={canManageStock(user.role) ? '/items/new' : null}
			theme={data.theme}
			seasonalEnabled={data.seasonalEnabled}
			initialCollapsed={data.sidebarCollapsed}
			barClass={seasonClasses?.bar ?? 'border-stone-200 bg-white'}
			onSeasonalChange={toggleSeasonalStyle}
			onSignOut={signOut}
		/>

		<!-- Signed-in desktops navigate with the sidebar; the header is for phones and tablets. -->
		<div class="no-print sticky top-0 z-40 lg:hidden">
			{#if menuOpen}
				<!-- Dims the page behind the open menu; tapping it closes the menu. -->
				<button
					type="button"
					aria-label={m.nav_close_menu()}
					tabindex="-1"
					class="fixed inset-0 -z-10 cursor-default bg-black/50"
					onclick={() => (menuOpen = false)}
				></button>
			{/if}
			<header class="border-b pt-[env(safe-area-inset-top)] backdrop-blur {barClass}">
				<div class="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
					<a href="/" class="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight">
						<img src="/icon.svg" alt="" class="h-8 w-8 rounded-lg ring-1 ring-stone-200" />
						{PUBLIC_APP_NAME}
					</a>

					<div class="ml-auto flex items-center gap-3">
						<button
							type="button"
							class="inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold transition {menuOpen
								? 'border border-stone-300 bg-white text-stone-800'
								: 'bg-stone-900 text-white shadow-sm'}"
							aria-expanded={menuOpen}
							aria-controls="account-menu"
							aria-label={menuOpen ? m.nav_close_menu() : m.nav_open_menu({ name: user.firstName })}
							onclick={() => (menuOpen = !menuOpen)}
						>
							{#if menuOpen}
								<NavIcon name="close" class="h-5 w-5" />
							{:else}
								<span aria-hidden="true">{initials(user.firstName, user.lastName)}</span>
							{/if}
						</button>
					</div>
				</div>

				{#if menuOpen}
					<div
						id="account-menu"
						class="max-h-[calc(100dvh-5rem-env(safe-area-inset-top))] overflow-y-auto overscroll-contain border-t border-stone-200 bg-white px-4 py-4 sm:px-6"
					>
						<div class="mx-auto max-w-6xl space-y-4">
							<div class="flex items-center gap-2 text-sm">
								<span class="font-medium">{user.name}</span>
								<span
									class="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700"
								>
									{roleLabel(user.role)}
								</span>
							</div>
							<nav class="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
								{#each menuLinks as link (link.href)}
									<a
										href={link.href}
										aria-current={isActive(link.href) ? 'page' : undefined}
										class="flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition {isActive(
											link.href
										)
											? 'bg-stone-900 text-white'
											: 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'}"
									>
										<NavIcon name={link.icon} class="h-5 w-5 shrink-0" />
										{link.label}
									</a>
								{/each}
							</nav>
							<div class="flex flex-wrap items-center gap-x-6 gap-y-3 px-3">
								<LanguageSwitcher />
								<ThemeToggle preference={data.theme} />
								<label
									class="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-stone-700"
								>
									<input
										type="checkbox"
										class="h-4 w-4 rounded border-stone-300"
										checked={data.seasonalEnabled}
										onchange={toggleSeasonalStyle}
									/>
									{m.seasonal_style()}
								</label>
							</div>
							<form
								method="POST"
								action="/logout"
								class="border-t border-stone-200 pt-2"
								onsubmit={signOut}
							>
								<button
									class="w-full rounded-lg px-3 py-3 text-left text-base font-medium text-red-700 transition hover:bg-red-50"
								>
									{m.nav_logout()}
								</button>
							</form>
						</div>
					</div>
				{/if}
			</header>
			{#if data.season === 'autumn'}<AutumnAccent
				/>{:else if data.season === 'christmas'}<ChristmasLights />{/if}
		</div>
	{/if}

	<main
		id="main"
		class="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 sm:px-6 sm:pt-8 xl:max-w-6xl 2xl:max-w-[100rem] {user
			? 'pb-[calc(6rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-10 lg:pb-12'
			: 'pb-6'}"
	>
		{#if user && hasBackButton(page.url.pathname)}
			<div class="mb-3"><BackButton parent={backTarget} /></div>
		{/if}
		{@render children()}
	</main>

	{#if user}
		{#if selection.size > 0 && !page.url.pathname.startsWith('/selection')}
			<a
				href="/selection"
				class="no-print fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 z-30 inline-flex min-h-14 items-center gap-2 rounded-full bg-stone-900 px-5 text-sm font-medium text-white shadow-lg transition active:scale-95 lg:bottom-6"
			>
				<span
					class="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold text-stone-900"
				>
					{selection.size}
				</span>
				{m.selection_open()}
			</a>
		{/if}

		<nav
			aria-label={m.nav_main()}
			class="no-print fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden {barClass}"
		>
			<ul
				class="mx-auto grid h-16 max-w-xl items-end"
				style="grid-template-columns: repeat({tabs.length}, minmax(0, 1fr))"
			>
				{#each tabs as tab (tab.href)}
					{@const active = isActive(tab.href)}
					<li class="flex justify-center">
						{#if tab.href === centerTabHref}
							<a
								href={tab.href}
								aria-current={active ? 'page' : undefined}
								class="flex -translate-y-3 flex-col items-center gap-1"
							>
								<span
									class="flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-4 ring-white transition active:scale-95 {active
										? 'bg-stone-900 text-white'
										: 'border border-stone-300 bg-white text-stone-800'}"
								>
									<NavIcon name={tab.icon} class="h-7 w-7" />
								</span>
								<span
									class="text-xs leading-none max-[360px]:text-[11px] {active
										? 'font-semibold text-stone-900'
										: 'text-stone-600'}">{tab.label}</span
								>
							</a>
						{:else}
							<a
								href={tab.href}
								aria-current={active ? 'page' : undefined}
								class="relative flex h-16 w-full flex-col items-center justify-center gap-1 transition active:scale-95"
							>
								<span
									class="flex h-8 w-12 items-center justify-center rounded-full transition {active
										? 'bg-stone-900/10 text-stone-900'
										: 'text-stone-500'}"
								>
									<NavIcon name={tab.icon} class="h-5 w-5" />
								</span>
								<span
									class="max-w-full truncate px-0.5 text-xs leading-none max-[360px]:text-[11px] {active
										? 'font-semibold text-stone-900'
										: 'text-stone-600'}">{tab.label}</span
								>
								{#if tab.badge}
									<span
										class="absolute top-1 right-[calc(50%-1.75rem)] flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white ring-2 ring-white"
									>
										{tab.badge}
									</span>
								{/if}
							</a>
						{/if}
					</li>
				{/each}
			</ul>
		</nav>
	{/if}
</div>
