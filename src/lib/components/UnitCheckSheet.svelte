<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ItemCard } from '#lib/server/items.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { groupUnitContents, missingFromCheck, type FoundCount } from '#lib/unit-contents.ts';
	import FilterSheet from './FilterSheet.svelte';

	// Check a unit's contents: every group starts as "all here"; the keeper lowers the counts of
	// what is not found. Missing pieces become lost when the check is confirmed.
	let { open = $bindable(false), pieces }: { open?: boolean; pieces: ItemCard[] } = $props();

	const groups = $derived(groupUnitContents(pieces));
	/** Found counts: group key → size → count; unset means everything was found. */
	let found = $state<Record<string, Record<string, number>>>({});
	let submitting = $state(false);

	const sized = (group: (typeof groups)[number]) => group.sizes.length > 1;
	const ALL = '\u0000all';
	const countOf = (key: string, size: string, max: number) => found[key]?.[size] ?? max;

	const answers = $derived(
		groups.map((group): FoundCount =>
			sized(group)
				? {
						groupKey: group.key,
						sizes: Object.fromEntries(
							group.sizes.map((entry) => [entry.size, countOf(group.key, entry.size, entry.count)])
						)
					}
				: { groupKey: group.key, count: countOf(group.key, ALL, group.count) }
		)
	);
	const missing = $derived(missingFromCheck(pieces, answers));

	function change(key: string, size: string, delta: number, max: number) {
		// Assign a new object: `found[key] ??= {}` would return the plain object, not the
		// reactive proxy, and the change would not show.
		const value = Math.min(max, Math.max(0, countOf(key, size, max) + delta));
		found = { ...found, [key]: { ...found[key], [size]: value } };
	}
</script>

{#snippet counter(key: string, size: string, max: number, label: string)}
	{@const value = countOf(key, size, max)}
	<div class="flex items-center justify-between gap-3">
		<span class="min-w-0 truncate text-sm text-stone-700">{label}</span>
		<div class="flex shrink-0 items-center gap-1">
			<button
				type="button"
				class="btn h-11 w-11 px-0"
				aria-label={m.take_out_less({ label })}
				disabled={value === 0}
				onclick={() => change(key, size, -1, max)}>−</button
			>
			<span class="w-16 text-center tabular-nums" aria-live="polite">
				<span class="text-2xl font-display {value < max ? 'text-red-700' : ''}">{value}</span>
				<span class="text-sm text-stone-500">/{max}</span>
			</span>
			<button
				type="button"
				class="btn h-11 w-11 px-0"
				aria-label={m.take_out_more({ label })}
				disabled={value >= max}
				onclick={() => change(key, size, 1, max)}>+</button
			>
		</div>
	</div>
{/snippet}

<FilterSheet
	bind:open
	title={m.check_title()}
	summary={m.check_summary({ found: pieces.length - missing.length, expected: pieces.length })}
	doneLabel={m.action_close()}
>
	<p class="mb-3 text-sm text-stone-600">{m.check_help()}</p>
	<ul class="divide-y divide-stone-100">
		{#each groups as group (group.key)}
			<li class="space-y-2 py-3">
				<p class="font-medium">{group.name}</p>
				{#if sized(group)}
					{#each group.sizes as entry (entry.size)}
						{@render counter(
							group.key,
							entry.size,
							entry.count,
							m.check_size({ size: entry.size || '–' })
						)}
					{/each}
				{:else}
					{@render counter(group.key, ALL, group.count, m.check_found())}
				{/if}
			</li>
		{/each}
	</ul>

	<form
		method="POST"
		action="?/check"
		class="sticky bottom-0 -mx-5 mt-4 border-t border-stone-100 bg-white px-5 pt-4"
		use:enhance={() => {
			submitting = true;
			return async ({ result, update }) => {
				submitting = false;
				await update();
				if (result.type === 'success') {
					found = {};
					open = false;
				}
			};
		}}
	>
		{#each pieces as piece (piece.id)}<input
				type="hidden"
				name="expectedId"
				value={piece.id}
			/>{/each}
		{#each missing as id (id)}<input type="hidden" name="missingId" value={id} />{/each}
		{#if missing.length}
			<p class="mb-2 text-sm text-red-700">{m.check_missing_warning({ count: missing.length })}</p>
		{/if}
		<button class="btn btn-primary w-full" disabled={submitting || !pieces.length}>
			{missing.length ? m.check_confirm_missing({ count: missing.length }) : m.check_confirm_all()}
		</button>
	</form>
</FilterSheet>
