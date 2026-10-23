<script lang="ts">
	import type { ItemCard } from '#lib/server/items.ts';
	import type { ItemGroup } from '#lib/item-groups.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { selection } from '#lib/selection.svelte.ts';
	import { isOverdue } from '#lib/format.ts';
	import ConditionBadge from './ConditionBadge.svelte';
	import Location from './Location.svelte';

	type Props = {
		item: ItemCard;
		/** When set, the card stands for all identical pieces and selects them together. */
		group?: ItemGroup | null;
		selectable?: boolean;
	};

	let { item, group = null, selectable = false }: Props = $props();

	const ids = $derived(group?.ids ?? [item.id]);
	const many = $derived(ids.length > 1);
	const selectedCount = $derived(ids.filter((id) => selection.has(id)).length);
	const selected = $derived(selectedCount === ids.length);
	const href = $derived(
		many
			? `/items/group?name=${encodeURIComponent(item.name)}&category=${encodeURIComponent(item.category ?? '')}&color=${encodeURIComponent(item.color ?? '')}`
			: `/items/${item.id}`
	);
	const overdue = $derived(
		group ? group.overdueCount > 0 : !!item.loan && isOverdue(item.loan.dueAt)
	);

	function toggle() {
		if (selected) selection.remove(...ids);
		else selection.add(...ids);
	}
</script>

<article
	class="card relative flex flex-col overflow-hidden transition {selected
		? 'ring-2 ring-brand-500'
		: selectedCount
			? 'ring-2 ring-brand-200'
			: ''}"
>
	<a {href} class="block aspect-square bg-stone-100">
		{#if item.photoId}
			<img
				src="/photos/{item.photoId}"
				alt={item.name}
				loading="lazy"
				class="h-full w-full object-cover"
			/>
		{:else}
			<div class="flex h-full items-center justify-center text-4xl text-stone-300">👗</div>
		{/if}
	</a>

	{#if selectable}
		<button
			type="button"
			class="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 shadow {selected
				? 'border-brand-700 bg-brand-700 text-white'
				: selectedCount
					? 'border-brand-300 bg-white text-brand-700'
					: 'border-white bg-white/80 text-transparent'}"
			aria-pressed={selected}
			aria-label={selected ? m.selection_remove() : m.selection_add()}
			onclick={toggle}
		>
			{selected || !selectedCount ? '✓' : selectedCount}
		</button>
	{/if}

	<div class="absolute top-2 left-2 flex flex-col items-start gap-1">
		{#if many}
			<span class="chip bg-stone-900/80 text-sm text-white">×{ids.length}</span>
		{/if}
		{#if overdue}
			<span class="chip bg-red-600 text-white">{m.loan_overdue()}</span>
		{/if}
	</div>

	<div class="flex flex-1 flex-col gap-1 p-2">
		<a {href} class="line-clamp-2 text-sm leading-tight font-medium">{item.name}</a>
		<div class="flex flex-wrap items-center gap-1 text-xs text-stone-500">
			{#if group && many}
				{#if group.sizes.length}<span>{group.sizes.join(', ')}</span>{/if}
				{#if group.attentionCount}
					<span class="chip bg-amber-100 text-amber-800">
						{m.group_attention({ count: group.attentionCount })}
					</span>
				{/if}
			{:else}
				<span class="font-mono">{item.code}</span>
				{#if item.size}<span>· {item.size}</span>{/if}
				{#if item.condition !== 'GOOD'}<ConditionBadge condition={item.condition} />{/if}
			{/if}
		</div>
		<div class="mt-auto pt-1">
			{#if group && many && !group.sameBox}
				<div class="flex flex-wrap gap-1 text-xs">
					{#if group.inCount}
						<span class="chip bg-stone-100 text-stone-700"
							>{m.group_in({ count: group.inCount })}</span
						>
					{/if}
					{#if group.outCount}
						<span class="chip bg-violet-100 text-violet-800"
							>{m.group_out({ count: group.outCount })}</span
						>
					{/if}
					{#if group.unstoredCount}
						<span class="chip bg-stone-100 text-stone-500">
							{m.group_unstored({ count: group.unstoredCount })}
						</span>
					{/if}
				</div>
			{:else}
				<Location {item} compact />
			{/if}
		</div>
	</div>
</article>
