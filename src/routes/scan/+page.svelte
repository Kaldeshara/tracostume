<script lang="ts">
	import { goto } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import type { ItemCard } from '#lib/server/items.ts';
	import { selection } from '#lib/selection.svelte.ts';
	import Location from '#lib/components/Location.svelte';
	import QrScanner from '#lib/components/QrScanner.svelte';
	import StockActions from '#lib/components/StockActions.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Box = { id: string; code: string; label: string; shelf: string | null };
	type Lookup =
		| { type: 'item'; item: ItemCard }
		| { type: 'box'; box: Box & { _count: { items: number } } }
		| { type: 'unknown'; code: string };

	// "collect": build a list of scanned items (and a target box) to act on them together.
	// "open": jump to the scanned item or box. Members can only open.
	let chosenMode = $state<'collect' | 'open'>('collect');
	const mode = $derived(data.stock ? chosenMode : 'open');
	let items = $state<ItemCard[]>([]);
	let box = $state<Box | null>(null);
	let message = $state<{ text: string; tone: 'ok' | 'warn' } | null>(null);
	let manualCode = $state('');

	async function lookup(value: string) {
		const response = await fetch(`/scan/lookup?code=${encodeURIComponent(value)}`);
		const result: Lookup = await response.json();

		if (result.type === 'unknown') {
			message = { text: m.scan_unknown({ code: result.code }), tone: 'warn' };
			return;
		}
		if (mode === 'open') {
			goto(result.type === 'item' ? `/items/${result.item.id}` : `/boxes/${result.box.id}`);
			return;
		}
		if (result.type === 'box') {
			box = result.box;
			message = {
				text: m.scan_box_selected({ box: `${result.box.code} · ${result.box.label}` }),
				tone: 'ok'
			};
		} else if (items.some((item) => item.id === result.item.id)) {
			message = { text: m.scan_already({ name: result.item.name }), tone: 'warn' };
		} else {
			items = [result.item, ...items];
			message = { text: `✓ ${result.item.name}`, tone: 'ok' };
		}
	}

	function submitManual(event: SubmitEvent) {
		event.preventDefault();
		if (manualCode.trim()) lookup(manualCode.trim());
		manualCode = '';
	}

	function reset() {
		items = [];
		box = null;
		message = null;
	}

	const someOut = $derived(items.some((item) => item.loan));
	const allOut = $derived(items.length > 0 && items.every((item) => item.loan));
	const someUncollected = $derived(items.some((item) => item.loan && !item.loan.collectedAt));
</script>

<svelte:head><title>{m.scan_title()}</title></svelte:head>

<div class="mx-auto flex max-w-md flex-col gap-4">
	<div class="flex items-center gap-2">
		<h1 class="flex-1">{m.scan_title()}</h1>
		{#if data.stock}
			<div class="flex rounded-lg border border-stone-300 bg-white p-0.5 text-sm">
				<button
					type="button"
					class="rounded-md px-3 py-1 {mode === 'collect' ? 'bg-brand-700 text-white' : ''}"
					onclick={() => (chosenMode = 'collect')}>{m.scan_mode_collect()}</button
				>
				<button
					type="button"
					class="rounded-md px-3 py-1 {mode === 'open' ? 'bg-brand-700 text-white' : ''}"
					onclick={() => (chosenMode = 'open')}>{m.scan_mode_open()}</button
				>
			</div>
		{/if}
	</div>

	<QrScanner onscan={lookup} />

	<form class="flex gap-2" onsubmit={submitManual}>
		<input
			class="input flex-1 font-mono uppercase"
			bind:value={manualCode}
			placeholder={m.scan_manual_placeholder()}
			autocapitalize="characters"
		/>
		<button class="btn">{m.scan_manual_submit()}</button>
	</form>

	{#if message}
		<p
			class="rounded-lg px-3 py-2 text-sm {message.tone === 'ok'
				? 'bg-emerald-50 text-emerald-800'
				: 'bg-amber-50 text-amber-800'}"
		>
			{message.text}
		</p>
	{/if}

	{#if mode === 'collect'}
		<p class="text-sm text-stone-600">{m.scan_collect_help()}</p>

		{#if box}
			<div class="card flex items-center gap-2 p-3">
				<span class="text-xl">▣</span>
				<div class="flex-1">
					<div class="text-xs text-stone-500 uppercase">{m.scan_target_box()}</div>
					<div class="font-medium">{box.code} · {box.label}</div>
				</div>
				<button type="button" class="text-stone-400" onclick={() => (box = null)} aria-label="✕"
					>✕</button
				>
			</div>
		{/if}

		{#if items.length}
			<ul class="card divide-y divide-stone-100">
				{#each items as item (item.id)}
					<li class="flex items-center gap-3 px-3 py-2">
						<div class="h-10 w-10 shrink-0 overflow-hidden rounded bg-stone-100">
							{#if item.photoId}<img
									src="/photos/{item.photoId}"
									alt=""
									class="h-full w-full object-cover"
								/>{/if}
						</div>
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-medium">{item.name}</div>
							<Location {item} compact />
						</div>
						<button
							type="button"
							class="text-stone-400"
							aria-label={m.selection_remove()}
							onclick={() => (items = items.filter((other) => other.id !== item.id))}>✕</button
						>
					</li>
				{/each}
			</ul>

			{#if data.stock}
				<StockActions
					itemIds={items.map((item) => item.id)}
					boxes={data.stock.boxes}
					users={data.stock.users}
					contacts={data.stock.contacts}
					role={data.user!.role}
					defaultBoxId={box?.id}
					{someOut}
					{allOut}
					{someUncollected}
					{form}
					ondone={() => {
						const count = items.length;
						reset();
						message = { text: m.scan_done({ count }), tone: 'ok' };
					}}
				/>
			{/if}

			<div class="flex gap-2">
				<button
					type="button"
					class="btn"
					onclick={() => {
						selection.add(...items.map((item) => item.id));
						goto('/selection');
					}}>{m.scan_to_selection()}</button
				>
				<button type="button" class="btn btn-danger" onclick={reset}>{m.selection_clear()}</button>
			</div>
		{/if}
	{/if}
</div>
