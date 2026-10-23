<script lang="ts">
	import { browser } from '$app/env';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate, isOverdue } from '#lib/format.ts';
	import { canManageStock } from '#lib/roles.ts';
	import { selection } from '#lib/selection.svelte.ts';
	import StockActions from '#lib/components/StockActions.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// A shared /selection?ids=… link opened with an empty selection adopts its items.
	const sharedIds = page.url.searchParams.get('ids')?.split(',').filter(Boolean) ?? [];
	if (browser && !selection.size && sharedIds.length) selection.add(...sharedIds);

	// Keep the URL in sync with the stored selection so the server returns its locations.
	$effect(() => {
		const ids = selection.ids.join(',');
		if (ids !== (page.url.searchParams.get('ids') ?? '')) {
			goto(ids ? `/selection?ids=${ids}` : '/selection', {
				replace: true,
				reset: false
			});
		}
	});

	type Item = (typeof data.items)[number];

	// "Where are they?": grouped by box (in shelf order), then by borrower, then the rest.
	const groups = $derived.by(() => {
		const byBox = new Map<string, { box: NonNullable<Item['box']>; items: Item[] }>();
		const byBorrower = new Map<string, Item[]>();
		const elsewhere: Item[] = [];
		for (const item of data.items) {
			if (item.loan) {
				const list = byBorrower.get(item.loan.borrower) ?? [];
				list.push(item);
				byBorrower.set(item.loan.borrower, list);
			} else if (item.box) {
				const group = byBox.get(item.box.id) ?? { box: item.box, items: [] };
				group.items.push(item);
				byBox.set(item.box.id, group);
			} else {
				elsewhere.push(item);
			}
		}
		return {
			boxes: [...byBox.values()].sort(
				(a, b) =>
					(a.box.shelf ?? '').localeCompare(b.box.shelf ?? '') ||
					a.box.label.localeCompare(b.box.label)
			),
			borrowers: [...byBorrower.entries()].sort(([a], [b]) => a.localeCompare(b)),
			elsewhere
		};
	});

	const someOut = $derived(data.items.some((item) => item.loan));
	const allOut = $derived(data.items.length > 0 && data.items.every((item) => item.loan));
</script>

<svelte:head><title>{m.selection_title()}</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="flex-1">{m.selection_title()}</h1>
	{#if selection.size}
		<a href="/map?items={selection.ids.join(',')}" class="btn btn-primary">{m.map_open()}</a>
		<a href="/labels?items={selection.ids.join(',')}" class="btn">{m.labels_print()}</a>
		<button type="button" class="btn btn-danger" onclick={() => selection.clear()}>
			{m.selection_clear()}
		</button>
	{/if}
</div>

{#if !selection.size}
	<div class="card p-8 text-center text-stone-500">
		<p>{m.selection_empty()}</p>
		<div class="mt-4 flex justify-center gap-2">
			<a href="/items" class="btn">{m.nav_gallery()}</a>
			<a href="/scan" class="btn btn-primary">{m.nav_scan()}</a>
		</div>
	</div>
{:else}
	{#if canManageStock(data.user?.role) && data.stock}
		<div class="mb-6">
			<p class="mb-2 text-sm text-stone-600">
				{m.selection_actions_for({ count: data.items.length })}
			</p>
			<StockActions
				itemIds={data.items.map((item) => item.id)}
				boxes={data.stock.boxes}
				users={data.stock.users}
				{someOut}
				{allOut}
				{form}
			/>
		</div>
	{/if}

	<div class="flex flex-col gap-4">
		{#each groups.boxes as group (group.box.id)}
			<section class="card overflow-hidden">
				<header class="flex flex-wrap items-baseline gap-2 bg-stone-100 px-4 py-2">
					<span class="text-lg">▣</span>
					<a href="/boxes/{group.box.id}" class="font-semibold hover:underline">
						{group.box.code} · {group.box.label}
					</a>
					<span class="text-sm text-stone-500">
						{group.box.container.name}{group.box.shelf ? ` · ${group.box.shelf}` : ''}
					</span>
					<span class="ml-auto text-sm text-stone-500">{group.items.length}</span>
				</header>
				{@render itemRows(group.items)}
			</section>
		{/each}

		{#each groups.borrowers as [borrower, items] (borrower)}
			<section class="card overflow-hidden">
				<header class="flex items-baseline gap-2 bg-violet-50 px-4 py-2">
					<span class="text-lg">👤</span>
					<span class="font-semibold">{borrower}</span>
					<span class="ml-auto text-sm text-stone-500">{items.length}</span>
				</header>
				{@render itemRows(items)}
			</section>
		{/each}

		{#if groups.elsewhere.length}
			<section class="card overflow-hidden">
				<header class="bg-stone-100 px-4 py-2 font-semibold">{m.location_unstored()}</header>
				{@render itemRows(groups.elsewhere)}
			</section>
		{/if}
	</div>
{/if}

{#snippet itemRows(items: Item[])}
	<ul class="divide-y divide-stone-100">
		{#each items as item (item.id)}
			<li class="flex items-center gap-3 px-4 py-2">
				<a
					href="/items/{item.id}"
					class="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-stone-100"
				>
					{#if item.photoId}
						<img src="/photos/{item.photoId}" alt="" class="h-full w-full object-cover" />
					{/if}
				</a>
				<div class="min-w-0 flex-1">
					<a href="/items/{item.id}" class="block truncate font-medium">{item.name}</a>
					<div class="text-xs text-stone-500">
						<span class="font-mono">{item.code}</span>
						{#if item.size}· {item.size}{/if}
						{#if item.loan?.dueAt}
							· <span class={isOverdue(item.loan.dueAt) ? 'font-medium text-red-700' : ''}>
								{m.location_due({ date: formatDate(item.loan.dueAt) })}
							</span>
						{/if}
					</div>
				</div>
				<button
					type="button"
					class="text-stone-400 hover:text-red-600"
					aria-label={m.selection_remove()}
					onclick={() => selection.remove(item.id)}>✕</button
				>
			</li>
		{/each}
	</ul>
{/snippet}
