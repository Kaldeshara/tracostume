<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { PUBLIC_APP_NAME } from '$app/env/public';
	import { m } from '#lib/paraglide/messages.js';
	import { canManageStock, canManageUsers, canSeeContainer } from '#lib/roles.ts';
	import { selection } from '#lib/selection.svelte.ts';
	import { roleLabel } from '#lib/format.ts';
	import LanguageSwitcher from '#lib/components/LanguageSwitcher.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	const user = $derived(data.user);
	let menuOpen = $state(false);

	const tabs = $derived([
		{ href: '/', label: m.nav_home(), icon: '⌂' },
		{ href: '/items', label: m.nav_gallery(), icon: '▦' },
		{ href: '/scan', label: m.nav_scan(), icon: '⌗', primary: true },
		{ href: '/loans', label: m.nav_loans(), icon: '⇄', badge: data.overdueCount },
		...(canSeeContainer(user?.role) ? [{ href: '/boxes', label: m.nav_boxes(), icon: '▣' }] : [])
	]);

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<title>{PUBLIC_APP_NAME}</title>
</svelte:head>

{#if user}
	<header class="no-print sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
		<div class="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
			<a href="/" class="flex items-center gap-2 font-semibold text-brand-800">
				<img src="/icon.svg" alt="" class="h-8 w-8" />
				<span>{PUBLIC_APP_NAME}</span>
			</a>
			<nav class="hidden flex-1 items-center gap-1 md:flex">
				{#each tabs as tab (tab.href)}
					<a
						href={tab.href}
						class="relative rounded-lg px-3 py-2 text-sm font-medium {isActive(tab.href)
							? 'bg-brand-50 text-brand-800'
							: 'text-stone-600 hover:bg-stone-100'}"
					>
						{tab.label}
						{#if tab.badge}
							<span class="chip ml-1 bg-red-600 text-white">{tab.badge}</span>
						{/if}
					</a>
				{/each}
			</nav>
			<div class="relative ml-auto md:ml-0">
				<button
					type="button"
					class="btn"
					aria-expanded={menuOpen}
					onclick={() => (menuOpen = !menuOpen)}
				>
					{user.firstName} ▾
				</button>
				{#if menuOpen}
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
					<div
						class="card absolute right-0 mt-2 flex w-60 flex-col gap-1 p-2 text-sm"
						onclick={() => (menuOpen = false)}
					>
						{#if canSeeContainer(user.role)}
							<a href="/map" class="rounded px-3 py-2 hover:bg-stone-100">{m.nav_map()}</a>
						{/if}
						{#if canManageStock(user.role)}
							<a href="/labels" class="rounded px-3 py-2 hover:bg-stone-100">{m.nav_labels()}</a>
						{/if}
						<span class="px-3 pt-2 text-xs text-stone-500">{roleLabel(user.role)}</span>
						{#if canManageUsers(user.role)}
							<a href="/users" class="rounded px-3 py-2 hover:bg-stone-100">{m.nav_users()}</a>
							<a href="/container" class="rounded px-3 py-2 hover:bg-stone-100"
								>{m.nav_container()}</a
							>
						{/if}
						<a href="/account" class="rounded px-3 py-2 hover:bg-stone-100">{m.nav_account()}</a>
						<div class="px-3 py-2"><LanguageSwitcher /></div>
						<form method="POST" action="/logout">
							<button class="w-full rounded px-3 py-2 text-left text-red-700 hover:bg-red-50">
								{m.nav_logout()}
							</button>
						</form>
					</div>
				{/if}
			</div>
		</div>
	</header>
{/if}

<main class="mx-auto max-w-6xl px-4 pt-4 pb-28 md:pb-10">
	{@render children()}
</main>

{#if user}
	{#if selection.size > 0 && !page.url.pathname.startsWith('/selection')}
		<a
			href="/selection"
			class="no-print fixed right-4 bottom-20 z-20 flex items-center gap-2 rounded-full bg-brand-700 px-4 py-3 text-sm font-medium text-white shadow-lg md:bottom-6"
		>
			<span class="chip bg-white text-brand-800">{selection.size}</span>
			{m.selection_open()}
		</a>
	{/if}

	<nav
		class="no-print fixed inset-x-0 bottom-0 z-20 grid border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
		style="grid-template-columns: repeat({tabs.length}, minmax(0, 1fr))"
	>
		{#each tabs as tab (tab.href)}
			<a
				href={tab.href}
				class="relative flex flex-col items-center gap-0.5 py-2 text-[11px] {isActive(tab.href)
					? 'text-brand-700'
					: 'text-stone-500'}"
			>
				<span
					class="flex h-7 items-center justify-center text-xl {tab.primary
						? '-mt-5 h-12 w-12 rounded-full bg-brand-700 text-white shadow-md'
						: ''}">{tab.icon}</span
				>
				{tab.label}
				{#if tab.badge}
					<span class="chip absolute top-1 right-3 bg-red-600 text-white">{tab.badge}</span>
				{/if}
			</a>
		{/each}
	</nav>
{/if}
