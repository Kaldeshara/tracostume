<script lang="ts">
	import type { ItemCard } from '#lib/server/items.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate, isOverdue } from '#lib/format.ts';

	let { item, compact = false }: { item: Pick<ItemCard, 'box' | 'loan'>; compact?: boolean } =
		$props();
</script>

{#if item.loan}
	<span class="flex flex-wrap items-center gap-1 text-sm">
		<span class="chip bg-violet-100 text-violet-800">{m.location_out()}</span>
		<span class="truncate">{item.loan.borrower}</span>
		{#if item.loan.dueAt && !compact}
			<span class={isOverdue(item.loan.dueAt) ? 'font-medium text-red-700' : 'text-stone-500'}>
				· {m.location_due({ date: formatDate(item.loan.dueAt) })}
			</span>
		{/if}
	</span>
{:else if item.box}
	<a href="/boxes/{item.box.id}" class="flex flex-wrap items-center gap-1 text-sm hover:underline">
		<span class="chip bg-stone-100 font-mono text-stone-700">{item.box.code}</span>
		<span class="truncate">{item.box.label}</span>
		{#if item.box.shelf && !compact}<span class="text-stone-500">· {item.box.shelf}</span>{/if}
	</a>
{:else}
	<span class="chip bg-stone-100 text-stone-500">{m.location_unstored()}</span>
{/if}
