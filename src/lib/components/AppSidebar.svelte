<script lang="ts" module>
	import type { NavIconName } from './NavIcon.svelte';

	export type SidebarLink = { href: string; label: string; icon: NavIconName; badge?: number };
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { PUBLIC_APP_NAME } from '$app/env/public';
	import { m } from '#lib/paraglide/messages.js';
	import { roleLabel } from '#lib/format.ts';
	import { applySidebarCollapsed, type ThemePreference } from '#lib/theme.ts';
	import NavIcon from './NavIcon.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import LanguageSwitcher from './LanguageSwitcher.svelte';

	// Desktop navigation (lg and up), ported from Tracster's AppSidebar. Phones and tablets use
	// the header and the bottom tab bar instead. Widths and label visibility live in layout.css
	// (`.app-sidebar`, `.sidebar-label`).

	let {
		user,
		mainLinks,
		managementLinks,
		newItemHref,
		theme,
		seasonalEnabled,
		initialCollapsed,
		barClass,
		onSeasonalChange,
		onSignOut
	}: {
		user: { name: string; role: Parameters<typeof roleLabel>[0] };
		mainLinks: SidebarLink[];
		managementLinks: SidebarLink[];
		newItemHref: string | null;
		theme: ThemePreference;
		seasonalEnabled: boolean;
		initialCollapsed: boolean;
		barClass: string;
		onSeasonalChange: (event: Event & { currentTarget: HTMLInputElement }) => void;
		onSignOut: (event: SubmitEvent) => void;
	} = $props();

	let toggled: boolean | undefined = $state();
	const collapsed = $derived(toggled ?? initialCollapsed);
	// Right after "collapse" the pointer is still over the sidebar: don't re-expand it on hover
	// until the pointer has left, or the click would seem to do nothing.
	let hoverExpandPaused = $state(false);

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);

	function toggleCollapsed(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
		toggled = !collapsed;
		applySidebarCollapsed(toggled);
		if (toggled) {
			hoverExpandPaused = true;
			event.currentTarget.blur();
		}
	}
</script>

{#snippet link(item: SidebarLink)}
	{@const active = isActive(item.href)}
	<a
		href={item.href}
		title={item.label}
		aria-current={active ? 'page' : undefined}
		class="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition {active
			? 'bg-stone-900 text-white'
			: 'text-stone-700 hover:bg-stone-900/5 hover:text-stone-900'}"
	>
		<span class="relative shrink-0">
			<NavIcon name={item.icon} class="h-5 w-5" />
			{#if item.badge}
				<span
					class="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white ring-2 ring-white"
				>
					{item.badge}
				</span>
			{/if}
		</span>
		<span class="sidebar-label truncate">{item.label}</span>
	</a>
{/snippet}

<aside
	onmouseleave={() => (hoverExpandPaused = false)}
	class="app-sidebar no-print fixed inset-y-0 left-0 z-40 hidden flex-col border-r transition-[width,box-shadow] duration-200 lg:flex {barClass} {hoverExpandPaused
		? 'sidebar-hover-off'
		: ''}"
>
	<div class="flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto px-3 py-4">
		<a href="/" class="mb-4 flex min-h-11 items-center gap-3 px-2 font-semibold tracking-tight">
			<img src="/icon.svg" alt="" class="h-9 w-9 shrink-0 rounded-lg ring-1 ring-stone-200" />
			<span class="sidebar-label truncate text-base leading-tight">{PUBLIC_APP_NAME}</span>
		</a>

		{#if newItemHref}
			<a
				href={newItemHref}
				title={m.item_new()}
				class="mb-3 flex min-h-11 items-center gap-3 rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-stone-700"
			>
				<NavIcon name="add" class="h-5 w-5 shrink-0" />
				<span class="sidebar-label truncate">{m.item_new()}</span>
			</a>
		{/if}

		<nav aria-label={m.nav_main()} class="flex flex-col gap-1">
			{#each mainLinks as item (item.href)}{@render link(item)}{/each}
		</nav>

		{#if managementLinks.length}
			<nav aria-label={m.nav_management()} class="mt-5 flex flex-col gap-1">
				<p class="sidebar-heading px-3 pb-1 text-xs font-semibold text-stone-500">
					{m.nav_management()}
				</p>
				{#each managementLinks as item (item.href)}{@render link(item)}{/each}
			</nav>
		{/if}

		<div class="mt-auto flex flex-col gap-3 pt-6">
			<button
				type="button"
				onclick={toggleCollapsed}
				aria-pressed={collapsed}
				title={collapsed ? m.nav_expand_sidebar() : m.nav_collapse_sidebar()}
				class="hidden min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-900/5 hover:text-stone-900 xl:flex"
			>
				<span class="shrink-0 transition-transform {collapsed ? 'rotate-180' : ''}">
					<NavIcon name="sidebar" class="h-5 w-5" />
				</span>
				<span class="sidebar-label truncate">
					{collapsed ? m.nav_expand_sidebar() : m.nav_collapse_sidebar()}
				</span>
			</button>
			<div class="sidebar-label space-y-3 px-1">
				<div class="flex items-center gap-2">
					<ThemeToggle preference={theme} />
					<LanguageSwitcher />
				</div>
				<label class="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
					<input
						type="checkbox"
						class="h-4 w-4 rounded border-stone-300"
						checked={seasonalEnabled}
						onchange={onSeasonalChange}
					/>
					{m.seasonal_style()}
				</label>
			</div>
			<a
				href="/account"
				title={m.nav_account()}
				aria-current={isActive('/account') ? 'page' : undefined}
				class="flex items-center gap-3 rounded-lg px-2 py-2 transition {isActive('/account')
					? 'bg-stone-900/10'
					: 'hover:bg-stone-900/5'}"
			>
				<span
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white"
				>
					<NavIcon name="account" class="h-5 w-5" />
				</span>
				<span class="sidebar-label flex min-w-0 flex-col items-start gap-0.5">
					<span class="max-w-full truncate text-sm font-medium text-stone-900">{user.name}</span>
					<span
						class="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700"
					>
						{roleLabel(user.role)}
					</span>
				</span>
			</a>
			<form method="POST" action="/logout" onsubmit={onSignOut}>
				<button
					title={m.nav_logout()}
					class="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
				>
					<NavIcon name="logout" class="h-5 w-5 shrink-0" />
					<span class="sidebar-label truncate">{m.nav_logout()}</span>
				</button>
			</form>
		</div>
	</div>
</aside>
