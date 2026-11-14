<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ItemCard } from '#lib/server/items.ts';
	import { groupUnitContents, type UnitGroup } from '#lib/unit-contents.ts';
	import ConditionBadge from './ConditionBadge.svelte';
	import NavIcon from './NavIcon.svelte';
	import type { ItemCondition } from '../../generated/prisma/enums';

	// A storage unit's contents grouped by model ("Jupe flamenco ×10 · 36 38 40"). Used by the
	// unit page and by the scanner offline; `actions` adds controls to each row.
	let {
		pieces,
		actions,
		empty
	}: {
		pieces: ItemCard[];
		actions?: Snippet<[UnitGroup]>;
		empty?: Snippet;
	} = $props();

	const groups = $derived(groupUnitContents(pieces));

	const groupHref = (group: UnitGroup) =>
		`/items/group?name=${encodeURIComponent(group.name)}&category=${encodeURIComponent(group.category)}&color=${encodeURIComponent(group.color ?? '')}`;
</script>

{#if groups.length}
	<ul class="card divide-y divide-stone-100 overflow-hidden">
		{#each groups as group (group.key)}
			<li class="flex items-center gap-3 p-3">
				<a href={groupHref(group)} class="flex min-w-0 flex-1 items-center gap-3">
					<span
						class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stone-100 text-stone-300"
					>
						{#if group.representative.photoId}
							<img
								src="/photos/{group.representative.photoId}"
								alt=""
								loading="lazy"
								class="h-full w-full object-cover"
							/>
						{:else}
							<NavIcon name="gallery" class="h-8 w-8" />
						{/if}
					</span>
					<span class="min-w-0 flex-1">
						<span class="flex items-baseline gap-2">
							<span class="truncate font-medium">{group.name}</span>
							<span class="shrink-0 text-xl font-display tabular-nums">×{group.count}</span>
						</span>
						{#if group.sizes.some((entry) => entry.size)}
							<span class="mt-1 flex flex-wrap gap-1">
								{#each group.sizes as entry (entry.size)}
									<span class="chip bg-stone-100 text-stone-700 tabular-nums">
										{entry.size || '–'}{entry.count > 1 ? ` ×${entry.count}` : ''}
									</span>
								{/each}
							</span>
						{/if}
						{#if Object.keys(group.attention).length}
							<span class="mt-1 flex flex-wrap gap-1">
								{#each Object.entries(group.attention) as [condition, count] (condition)}
									<span class="inline-flex items-center gap-1 text-xs text-stone-600">
										<ConditionBadge condition={condition as ItemCondition} />×{count}
									</span>
								{/each}
							</span>
						{/if}
					</span>
				</a>
				{#if actions}{@render actions(group)}{/if}
			</li>
		{/each}
	</ul>
{:else if empty}
	{@render empty()}
{/if}
