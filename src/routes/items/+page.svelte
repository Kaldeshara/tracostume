<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { CONDITIONS, conditionLabel } from '#lib/format.ts';
	import {
		CATEGORIES_BY_GROUP,
		CATEGORY_GROUPS,
		categoryGroupLabel,
		categoryLabel
	} from '#lib/categories.ts';
	import { canManageStock } from '#lib/roles.ts';
	import { selection } from '#lib/selection.svelte.ts';
	import ItemCard from '#lib/components/ItemCard.svelte';
	import FilterSheet from '#lib/components/FilterSheet.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let showFilters = $state(false);
	const activeFilterCount = $derived(
		[data.filters.category, data.filters.condition, data.filters.status, data.filters.box].filter(
			Boolean
		).length
	);

	const statusLabels = {
		in: m.status_in,
		out: m.status_out,
		overdue: m.status_overdue,
		unstored: m.status_unstored
	};

	// Filters apply as soon as they change; the search box applies on submit.
	function applyFilter(event: Event & { currentTarget: HTMLSelectElement }) {
		const params = new URLSearchParams(page.url.search);
		const { name, value } = event.currentTarget;
		if (value) params.set(name, value);
		else params.delete(name);
		goto(`?${params}`, { replace: true, reset: false });
	}

	const selectAllVisible = () => selection.add(...data.groups.flatMap((group) => group.ids));
	import Fab from '#lib/components/Fab.svelte';
	import NavIcon from '#lib/components/NavIcon.svelte';
</script>

<svelte:head><title>{m.gallery_title()}</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="flex-1">{m.gallery_title()}</h1>
	{#if canManageStock(data.user?.role)}
		<a href="/items/new" class="btn btn-primary hidden lg:inline-flex"
			><NavIcon name="add" class="h-4 w-4" />{m.item_new()}</a
		>
		<Fab href="/items/new" label={m.item_new()} />
	{/if}
</div>

{#if data.repairer}
	<p class="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
		{m.gallery_repairer_hint()}
	</p>
{/if}

<form method="GET" class="mb-3 flex gap-2">
	{#each ['category', 'condition', 'status', 'box'] as const as key (key)}
		{#if data.filters[key]}<input type="hidden" name={key} value={data.filters[key]} />{/if}
	{/each}
	<input
		class="input flex-1"
		type="search"
		name="q"
		value={data.filters.q}
		placeholder={m.gallery_search_placeholder()}
		enterkeyhint="search"
	/>
	<button class="btn btn-primary">{m.gallery_search()}</button>
	<button
		type="button"
		aria-haspopup="dialog"
		aria-label={m.gallery_filters_count({ count: activeFilterCount })}
		title={m.gallery_filters()}
		class="relative inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition md:px-3 {activeFilterCount
			? 'border-stone-900 bg-stone-900 text-white hover:bg-stone-700'
			: 'border-stone-300 bg-white text-stone-900 hover:bg-stone-100'}"
		onclick={() => (showFilters = true)}
	>
		<svg
			viewBox="0 0 24 24"
			class="h-5 w-5"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M3 5h18l-7 8.5V19l-4 2v-7.5Z" />
		</svg>
		<span class="hidden md:inline">{m.gallery_filters()}</span>
		{#if activeFilterCount}
			<span
				aria-hidden="true"
				class="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-semibold text-white ring-2 ring-white"
			>
				{activeFilterCount}
			</span>
		{/if}
	</button>
</form>

<FilterSheet bind:open={showFilters} title={m.gallery_filters()}>
	<div class="grid gap-3">
		<select class="input" name="category" value={data.filters.category} onchange={applyFilter}>
			<option value="">{m.filter_all_categories()}</option>
			{#each CATEGORY_GROUPS as group (group)}
				<optgroup label={categoryGroupLabel(group)}>
					{#each CATEGORIES_BY_GROUP[group] as category (category)}
						<option value={category}>{categoryLabel(category)}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
		<select class="input" name="status" value={data.filters.status} onchange={applyFilter}>
			<option value="">{m.filter_all_statuses()}</option>
			{#each Object.entries(statusLabels) as [value, label] (value)}
				<option {value}>{label()}</option>
			{/each}
		</select>
		<select class="input" name="condition" value={data.filters.condition} onchange={applyFilter}>
			<option value="">{m.filter_all_conditions()}</option>
			{#each CONDITIONS as condition (condition)}
				<option value={condition}>{conditionLabel(condition)}</option>
			{/each}
		</select>
		<select class="input" name="box" value={data.filters.box} onchange={applyFilter}>
			<option value="">{m.filter_all_boxes()}</option>
			{#each data.boxes as box (box.id)}<option value={box.id}>{box.code} · {box.label}</option
				>{/each}
		</select>
	</div>
</FilterSheet>

<div class="mb-3 flex flex-wrap items-center gap-3 text-sm text-stone-600">
	<span
		>{data.semantic
			? m.gallery_semantic_count({ count: data.total })
			: m.gallery_count({ count: data.total })}</span
	>
	{#if data.groups.length}
		<button type="button" class="link" onclick={selectAllVisible}>{m.selection_add_all()}</button>
	{/if}
	{#if data.groupTotal > data.groups.length}
		<span>{m.gallery_truncated({ count: data.groups.length })}</span>
	{/if}
</div>

{#if data.groups.length}
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
		{#each data.groups as group (group.key)}
			<ItemCard item={group.representative} {group} selectable />
		{/each}
	</div>
{:else}
	<p class="card p-8 text-center text-stone-500">{m.gallery_empty()}</p>
{/if}
