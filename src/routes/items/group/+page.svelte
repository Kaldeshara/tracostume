<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { selection } from '#lib/selection.svelte.ts';
	import { categoryLabel } from '#lib/categories.ts';
	import ConditionBadge from '#lib/components/ConditionBadge.svelte';
	import Location from '#lib/components/Location.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const group = $derived(data.group);
	const allSelected = $derived(group.ids.every((id) => selection.has(id)));
</script>

<svelte:head><title>{group.name}</title></svelte:head>

<div class="mb-6 flex flex-col gap-4 md:flex-row md:items-start">
	<div class="card h-40 w-40 shrink-0 overflow-hidden bg-stone-100">
		{#if group.representative.photoId}
			<img src="/photos/{group.representative.photoId}" alt="" class="h-full w-full object-cover" />
		{/if}
	</div>
	<div class="flex-1">
		<p class="text-sm text-stone-500">
			{[categoryLabel(group.category), group.color].filter(Boolean).join(' · ')}
		</p>
		<h1>{group.name}</h1>
		<p class="mt-1 text-stone-600">{m.group_title({ count: group.count })}</p>
		<div class="mt-2 flex flex-wrap gap-1 text-xs">
			{#if group.inCount}
				<span class="chip bg-stone-100 text-stone-700">{m.group_in({ count: group.inCount })}</span>
			{/if}
			{#if group.outCount}
				<span class="chip bg-violet-100 text-violet-800"
					>{m.group_out({ count: group.outCount })}</span
				>
			{/if}
			{#if group.overdueCount}
				<span class="chip bg-red-100 text-red-800"
					>{m.group_overdue({ count: group.overdueCount })}</span
				>
			{/if}
			{#if group.unstoredCount}
				<span class="chip bg-stone-100 text-stone-500"
					>{m.group_unstored({ count: group.unstoredCount })}</span
				>
			{/if}
		</div>
		<div class="mt-4 flex flex-wrap gap-2">
			<button
				type="button"
				class="btn {allSelected ? '' : 'btn-primary'}"
				onclick={() => (allSelected ? selection.remove(...group.ids) : selection.add(...group.ids))}
			>
				{allSelected ? m.group_unselect_all() : m.selection_add_all()}
			</button>
			<a class="btn" href="/map?items={group.ids.join(',')}">{m.map_open()}</a>
		</div>
	</div>
</div>

<ul class="card divide-y divide-stone-100">
	{#each data.items as item (item.id)}
		{@const selected = selection.has(item.id)}
		<li class="flex items-center gap-3 px-4 py-2 {selected ? 'bg-brand-50' : ''}">
			<button
				type="button"
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 {selected
					? 'border-brand-700 bg-brand-700 text-white'
					: 'border-stone-300 text-transparent'}"
				aria-pressed={selected}
				aria-label={selected ? m.selection_remove() : m.selection_add()}
				onclick={() => selection.toggle(item.id)}>✓</button
			>
			<div class="min-w-0 flex-1">
				<a href="/items/{item.id}" class="flex flex-wrap items-center gap-2 text-sm">
					<span class="font-mono font-medium">{item.code}</span>
					{#if item.size}<span>{item.size}</span>{/if}
					{#if item.condition !== 'GOOD'}<ConditionBadge condition={item.condition} />{/if}
				</a>
				<Location {item} compact />
			</div>
			<a href="/items/{item.id}" class="text-stone-400" aria-label={item.code}>›</a>
		</li>
	{/each}
</ul>
