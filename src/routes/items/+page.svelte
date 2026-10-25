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
</script>

<svelte:head><title>{m.gallery_title()}</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="flex-1">{m.gallery_title()}</h1>
	{#if canManageStock(data.user?.role)}
		<a href="/items/new" class="btn btn-primary">+ {m.item_new()}</a>
	{/if}
</div>

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
	<button type="button" class="btn" onclick={() => (showFilters = !showFilters)}>
		{m.gallery_filters()}{activeFilterCount ? ` (${activeFilterCount})` : ''}
	</button>
</form>

{#if showFilters || activeFilterCount}
	<div class="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
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
{/if}

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
