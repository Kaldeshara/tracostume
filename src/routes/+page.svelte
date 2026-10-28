<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate, isOverdue } from '#lib/format.ts';
	import ItemCard from '#lib/components/ItemCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="flex flex-col gap-6">
	<h1>{m.home_hello({ name: data.user?.firstName ?? '' })}</h1>

	<form method="GET" action="/items" class="flex gap-2">
		<input
			class="input flex-1 py-3 text-base"
			type="search"
			name="q"
			placeholder={m.gallery_search_placeholder()}
			enterkeyhint="search"
		/>
		<button class="btn btn-primary px-5">{m.gallery_search()}</button>
	</form>

	<a href="/scan" class="card flex items-center gap-4 bg-brand-700 p-5 text-white md:hidden">
		<span class="text-4xl">⌗</span>
		<div>
			<div class="text-lg font-semibold">{m.home_scan()}</div>
			<div class="text-sm text-brand-100">{m.home_scan_help()}</div>
		</div>
	</a>

	<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
		<a href="/items" class="card p-4">
			<div class="text-3xl font-semibold">{data.stats.itemCount}</div>
			<div class="text-sm text-stone-600">{m.home_stat_items()}</div>
		</a>
		<a href="/items?status=out" class="card p-4">
			<div class="text-3xl font-semibold">{data.stats.outCount}</div>
			<div class="text-sm text-stone-600">{m.home_stat_out()}</div>
		</a>
		<a href="/loans" class="card p-4 {data.stats.overdueCount ? 'border-red-200 bg-red-50' : ''}">
			<div class="text-3xl font-semibold {data.stats.overdueCount ? 'text-red-700' : ''}">
				{data.stats.overdueCount}
			</div>
			<div class="text-sm text-stone-600">{m.home_stat_overdue()}</div>
		</a>
		<a href="/items?condition=TO_REPAIR" class="card p-4">
			<div class="text-3xl font-semibold">{data.stats.attentionCount}</div>
			<div class="text-sm text-stone-600">{m.home_stat_attention()}</div>
		</a>
	</div>

	{#if data.role === 'REPAIRER'}
		<section>
			<h2 class="mb-1">{m.home_repair_title()}</h2>
			<p class="mb-2 text-sm text-stone-600">{m.home_repair_help()}</p>
			{#if data.repairItems.length}
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
					{#each data.repairItems as item (item.id)}<ItemCard {item} selectable />{/each}
				</div>
			{:else}
				<p class="card p-6 text-center text-stone-500">{m.home_repair_empty()}</p>
			{/if}
		</section>
	{/if}

	{#if data.role === 'CHOREOGRAPHER' && data.contactLoans.length}
		<section>
			<h2 class="mb-1">{m.home_contact_title()}</h2>
			<p class="mb-2 text-sm text-stone-600">{m.home_contact_help()}</p>
			<ul class="card divide-y divide-stone-100">
				{#each data.contactLoans as loan (loan.id)}
					<li>
						<a href="/items/{loan.item.id}" class="flex items-center gap-3 px-4 py-2">
							<div class="h-10 w-10 shrink-0 overflow-hidden rounded bg-stone-100">
								{#if loan.item.photoId}<img
										src="/photos/{loan.item.photoId}"
										alt=""
										class="h-full w-full object-cover"
									/>{/if}
							</div>
							<div class="min-w-0 flex-1">
								<div class="truncate">{loan.item.name}</div>
								<div class="text-xs text-stone-500">{loan.borrower}</div>
							</div>
							{#if loan.collectedAt}
								<span class="chip bg-amber-100 text-amber-800">{m.loan_collected()}</span>
							{:else if loan.dueAt}
								<span
									class="text-sm {isOverdue(loan.dueAt)
										? 'font-semibold text-red-700'
										: 'text-stone-500'}"
								>
									{formatDate(loan.dueAt)}
								</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.myLoans.length}
		<section>
			<h2 class="mb-1">{m.home_my_loans()}</h2>
			<p class="mb-2 text-sm text-stone-600">{m.home_my_loans_help()}</p>
			<ul class="card divide-y divide-stone-100">
				{#each data.myLoans as loan (loan.id)}
					<li>
						<a href="/items/{loan.item.id}" class="flex items-center gap-3 px-4 py-2">
							<div class="h-10 w-10 shrink-0 overflow-hidden rounded bg-stone-100">
								{#if loan.item.photoId}<img
										src="/photos/{loan.item.photoId}"
										alt=""
										class="h-full w-full object-cover"
									/>{/if}
							</div>
							<div class="min-w-0 flex-1">
								<div class="truncate">{loan.item.name}</div>
								<div class="text-xs text-brand-700">
									{loan.collectedAt
										? m.loan_collected_by({ name: loan.contact ?? '' })
										: loan.contact
											? m.loan_return_to({ name: loan.contact })
											: m.loan_return_to_keeper()}
								</div>
							</div>
							{#if loan.dueAt}
								<span
									class="text-sm {isOverdue(loan.dueAt)
										? 'font-semibold text-red-700'
										: 'text-stone-500'}"
								>
									{formatDate(loan.dueAt)}
								</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.keeper}
		<section class="grid grid-cols-1 gap-3 md:grid-cols-3">
			<a href="/items/new" class="card p-4 hover:border-brand-200">
				<div class="font-semibold">+ {m.item_new()}</div>
				<div class="text-sm text-stone-600">{m.home_new_item_help()}</div>
			</a>
			<a href="/loans" class="card p-4 hover:border-brand-200">
				<div class="font-semibold">{m.loans_title()}</div>
				<div class="text-sm text-stone-600">{m.home_loans_help()}</div>
			</a>
			<a href="/map" class="card p-4 hover:border-brand-200">
				<div class="font-semibold">{m.nav_map()}</div>
				<div class="text-sm text-stone-600">{m.home_boxes_help()}</div>
			</a>
		</section>
	{/if}
</div>
