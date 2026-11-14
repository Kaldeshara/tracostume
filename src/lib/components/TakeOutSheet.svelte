<script lang="ts">
	import type { UserRole } from '../../generated/prisma/enums';
	import type { ItemCard } from '#lib/server/items.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { groupUnitContents, pickPieces, type PickRequest } from '#lib/unit-contents.ts';
	import FilterSheet from './FilterSheet.svelte';
	import StockActions, { type Action } from './StockActions.svelte';

	// Take pieces out of a unit: choose how many of each model (per size when sizes differ),
	// then lend them or move them with the usual stock actions.
	type Person = { id: string; firstName: string; lastName: string };
	let {
		open = $bindable(false),
		pieces,
		unitId,
		role,
		stock,
		form = null,
		onoffline
	}: {
		open?: boolean;
		pieces: ItemCard[];
		/** The unit the pieces come from (not offered as a destination). */
		unitId: string;
		role: UserRole;
		stock: {
			boxes: { id: string; code: string; label: string; shelf: string | null }[];
			users: Person[];
			contacts: Person[];
		};
		form?: { done?: string; count?: number; error?: string; codes?: string[] } | null;
		onoffline?: (action: Action, form: FormData) => void;
	} = $props();

	const groups = $derived(groupUnitContents(pieces).filter((group) => group.available > 0));
	const ANY = '\u0000any';
	/** Chosen counts: group key → size (or ANY) → count. */
	let chosen = $state<Record<string, Record<string, number>>>({});

	const sizedGroup = (group: (typeof groups)[number]) =>
		group.sizes.filter((entry) => entry.available > 0).length > 1;

	const requests = $derived(
		groups.map((group): PickRequest => {
			const counts = chosen[group.key] ?? {};
			return sizedGroup(group)
				? {
						groupKey: group.key,
						sizes: Object.fromEntries(Object.entries(counts).filter(([size]) => size !== ANY))
					}
				: { groupKey: group.key, count: counts[ANY] ?? 0 };
		})
	);
	const picked = $derived.by(() => {
		try {
			return pickPieces(pieces, requests);
		} catch {
			return [];
		}
	});

	function change(groupKey: string, size: string, delta: number, max: number) {
		// Assign a new object (see UnitCheckSheet): mutating `chosen[groupKey] ??= {}` is not tracked.
		const value = Math.min(max, Math.max(0, (chosen[groupKey]?.[size] ?? 0) + delta));
		chosen = { ...chosen, [groupKey]: { ...chosen[groupKey], [size]: value } };
	}

	function reset() {
		chosen = {};
		open = false;
	}
</script>

{#snippet counter(groupKey: string, size: string, max: number, label: string)}
	{@const value = chosen[groupKey]?.[size] ?? 0}
	<div class="flex items-center justify-between gap-3">
		<span class="min-w-0 truncate text-sm text-stone-700">{label}</span>
		<div class="flex shrink-0 items-center gap-1">
			<button
				type="button"
				class="btn h-11 w-11 px-0"
				aria-label={m.take_out_less({ label })}
				disabled={value === 0}
				onclick={() => change(groupKey, size, -1, max)}>−</button
			>
			<span class="w-12 text-center text-2xl font-display tabular-nums" aria-live="polite"
				>{value}</span
			>
			<button
				type="button"
				class="btn h-11 w-11 px-0"
				aria-label={m.take_out_more({ label })}
				disabled={value >= max}
				onclick={() => change(groupKey, size, 1, max)}>+</button
			>
		</div>
	</div>
{/snippet}

<FilterSheet
	bind:open
	title={m.take_out_title()}
	summary={m.take_out_summary({ count: picked.length })}
	doneLabel={m.action_close()}
>
	{#if groups.length}
		<ul class="divide-y divide-stone-100">
			{#each groups as group (group.key)}
				<li class="space-y-2 py-3">
					<p class="font-medium">{group.name}</p>
					{#if sizedGroup(group)}
						{#each group.sizes.filter((entry) => entry.available > 0) as entry (entry.size)}
							{@render counter(
								group.key,
								entry.size,
								entry.available,
								m.take_out_size({ size: entry.size || '–', available: entry.available })
							)}
						{/each}
					{:else}
						{@render counter(
							group.key,
							ANY,
							group.available,
							m.take_out_available({ available: group.available })
						)}
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty-state">{m.take_out_nothing()}</p>
	{/if}

	{#if picked.length}
		<div class="sticky bottom-0 -mx-5 mt-4 border-t border-stone-100 bg-white px-5 pt-4">
			<StockActions
				itemIds={picked}
				boxes={stock.boxes.filter((box) => box.id !== unitId)}
				users={stock.users}
				contacts={stock.contacts}
				{role}
				{form}
				ondone={reset}
				{onoffline}
			/>
		</div>
	{/if}
</FilterSheet>
