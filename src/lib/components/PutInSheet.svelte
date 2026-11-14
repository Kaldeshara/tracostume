<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ItemCard } from '#lib/server/items.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { groupUnitContents } from '#lib/unit-contents.ts';
	import FilterSheet from './FilterSheet.svelte';

	// Put pieces into a unit: pieces coming back from loans (by borrower), or pieces found with
	// the search (by default those stored nowhere). Returning a lent piece closes its loan.
	let {
		open = $bindable(false),
		unitId,
		lentPieces,
		searchable = true,
		onoffline
	}: {
		open?: boolean;
		unitId: string;
		lentPieces: ItemCard[];
		/** Off when offline: only the returns known on the phone are offered. */
		searchable?: boolean;
		onoffline?: (form: FormData) => void;
	} = $props();

	let tab = $state<'returns' | 'search'>('returns');
	let selected = $state(new Set<string>());
	let query = $state('');
	let unstoredOnly = $state(true);
	let results = $state<ItemCard[]>([]);
	let searching = $state(false);
	let searched = $state(false);
	let submitting = $state(false);
	let message = $state('');

	const borrowers = $derived.by(() => {
		const byName = new Map<string, { name: string; collected: boolean; pieces: ItemCard[] }>();
		for (const piece of lentPieces) {
			const name = piece.loan?.borrower || '–';
			const entry = byName.get(name) ?? { name, collected: true, pieces: [] };
			entry.pieces.push(piece);
			if (!piece.loan?.collectedAt) entry.collected = false;
			byName.set(name, entry);
		}
		return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
	});
	const resultGroups = $derived(groupUnitContents(results));

	function toggle(ids: string[], on: boolean) {
		const next = new Set(selected);
		for (const id of ids) {
			if (on) next.add(id);
			else next.delete(id);
		}
		selected = next;
	}
	const allSelected = (ids: string[]) => ids.length > 0 && ids.every((id) => selected.has(id));

	let timer: ReturnType<typeof setTimeout> | undefined;
	async function search() {
		searching = true;
		searched = true;
		const params = new URLSearchParams({ q: query, unstored: unstoredOnly ? '1' : '0' });
		try {
			const response = await fetch(`/boxes/${unitId}/candidates?${params}`);
			results = response.ok ? await response.json() : [];
		} catch {
			results = [];
		} finally {
			searching = false;
		}
	}
	function scheduleSearch() {
		clearTimeout(timer);
		timer = setTimeout(search, 300);
	}
	$effect(() => {
		// First visit of the Search tab: list the pieces stored nowhere (once).
		if (open && searchable && tab === 'search' && !searched) search();
	});

	function done(count: number) {
		message = m.put_in_done({ count });
		results = results.filter((piece) => !selected.has(piece.id));
		selected = new Set();
		open = false;
	}
</script>

{#snippet checkRow(ids: string[], label: string, detail: string)}
	<label class="flex min-h-11 cursor-pointer items-center gap-3 py-2">
		<input
			type="checkbox"
			class="h-5 w-5 rounded border-stone-300"
			checked={allSelected(ids)}
			onchange={(event) => toggle(ids, event.currentTarget.checked)}
		/>
		<span class="min-w-0 flex-1">
			<span class="block truncate font-medium">{label}</span>
			<span class="block text-sm text-stone-500">{detail}</span>
		</span>
	</label>
{/snippet}

<FilterSheet
	bind:open
	title={m.put_in_title()}
	summary={m.take_out_summary({ count: selected.size })}
	doneLabel={m.action_close()}
>
	{#if searchable}
		<div role="radiogroup" aria-label={m.put_in_title()} class="segmented mb-4">
			<button
				type="button"
				role="radio"
				aria-checked={tab === 'returns'}
				class="segmented-option"
				onclick={() => (tab = 'returns')}>{m.put_in_returns()}</button
			>
			<button
				type="button"
				role="radio"
				aria-checked={tab === 'search'}
				class="segmented-option"
				onclick={() => (tab = 'search')}>{m.put_in_search()}</button
			>
		</div>
	{/if}

	{#if tab === 'returns' || !searchable}
		{#if borrowers.length}
			<ul class="divide-y divide-stone-100">
				{#each borrowers as borrower (borrower.name)}
					<li>
						{@render checkRow(
							borrower.pieces.map((piece) => piece.id),
							borrower.name,
							m.put_in_borrower_detail({
								count: borrower.pieces.length,
								names: [...new Set(borrower.pieces.map((piece) => piece.name))].join(', ')
							}) + (borrower.collected ? ` · ${m.put_in_collected()}` : '')
						)}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">{m.put_in_no_returns()}</p>
		{/if}
	{:else}
		<input
			class="input mb-2"
			type="search"
			placeholder={m.put_in_search_placeholder()}
			bind:value={query}
			oninput={scheduleSearch}
		/>
		<label class="mb-3 flex items-center gap-2 text-sm text-stone-700">
			<input
				type="checkbox"
				class="h-4 w-4 rounded border-stone-300"
				bind:checked={unstoredOnly}
				onchange={search}
			/>
			{m.put_in_unstored_only()}
		</label>
		{#if searching && !results.length}
			<p class="text-sm text-stone-500">…</p>
		{:else if resultGroups.length}
			<ul class="divide-y divide-stone-100">
				{#each resultGroups as group (group.key)}
					<li>
						{@render checkRow(
							group.pieces.map((piece) => piece.id),
							`${group.name} ×${group.count}`,
							[
								group.sizes
									.map((entry) => entry.size)
									.filter(Boolean)
									.join(' · '),
								group.pieces[0].box ? group.pieces[0].box.label : m.status_unstored()
							]
								.filter(Boolean)
								.join(' — ')
						)}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">{m.put_in_no_results()}</p>
		{/if}
	{/if}

	{#if selected.size}
		<form
			method="POST"
			action="?/place"
			class="sticky bottom-0 -mx-5 mt-4 border-t border-stone-100 bg-white px-5 pt-4"
			use:enhance={({ formData, cancel }) => {
				if (onoffline && !navigator.onLine) {
					onoffline(formData);
					cancel();
					done(selected.size);
					return;
				}
				submitting = true;
				return async ({ result, update }) => {
					submitting = false;
					await update();
					if (result.type === 'success') done(Number(result.data?.count ?? selected.size));
				};
			}}
		>
			<input type="hidden" name="boxId" value={unitId} />
			{#each [...selected] as id (id)}<input type="hidden" name="itemId" value={id} />{/each}
			<button class="btn btn-primary w-full" disabled={submitting}>
				{m.put_in_submit({ count: selected.size })}
			</button>
		</form>
	{/if}
</FilterSheet>

{#if message}
	<p role="status" class="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
		{message}
	</p>
{/if}
