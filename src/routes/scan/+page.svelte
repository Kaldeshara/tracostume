<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDateTime } from '#lib/format.ts';
	import { canManageStock } from '#lib/roles.ts';
	import { offlineScan, type ScanBox, type ScanResult } from '#lib/offline-scan.svelte.ts';
	import QrScanner from '#lib/components/QrScanner.svelte';
	import UnitContents from '#lib/components/UnitContents.svelte';
	import TakeOutSheet from '#lib/components/TakeOutSheet.svelte';
	import PutInSheet from '#lib/components/PutInSheet.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Scanning opens what the label points to: a storage unit (labels go on units), the container,
	// or a piece from an older label. Without signal in the container, a unit opens here from the
	// copy kept on the phone, and its take-out and put-in are queued until the network is back.
	let message = $state<{ text: string; tone: 'ok' | 'warn' } | null>(null);
	let manualCode = $state('');
	let offlineUnit = $state<ScanBox | null>(null);
	let takingOut = $state(false);
	let puttingIn = $state(false);
	const keeper = $derived(canManageStock(data.user?.role));

	onMount(() => {
		// Keep the copy of pieces and units fresh, and send what was done offline.
		if (data.stock && navigator.onLine) {
			offlineScan.flush().then(() => offlineScan.refreshCatalogue());
		}
	});

	/** Asks the server; without a connection, uses the copy kept on the phone. */
	async function resolve(value: string): Promise<{ result: ScanResult; online: boolean }> {
		if (navigator.onLine) {
			try {
				const response = await fetch(`/scan/lookup?code=${encodeURIComponent(value)}`);
				if (response.ok) return { result: await response.json(), online: true };
			} catch {
				// No connection after all: fall back to the copy.
			}
		}
		return { result: offlineScan.lookup(value), online: false };
	}

	async function lookup(value: string) {
		const { result, online } = await resolve(value);
		message = null;
		if (result.type === 'unknown') {
			message = { text: m.scan_unknown({ code: result.code }), tone: 'warn' };
			return;
		}
		if (online) {
			offlineUnit = null;
			if (result.type === 'item') goto(`/items/${result.item.id}`);
			else if (result.type === 'box') goto(`/boxes/${result.box.id}`);
			else goto('/boxes');
			return;
		}
		if (result.type === 'box') {
			offlineUnit = result.box;
		} else if (result.type === 'item') {
			const { item } = result;
			const where = item.loan
				? m.scan_piece_lent({ name: item.loan.borrower })
				: item.box
					? `${item.box.code} · ${item.box.label}`
					: m.status_unstored();
			message = { text: m.scan_piece_offline({ name: item.name, where }), tone: 'ok' };
		} else {
			message = { text: m.scan_offline_open(), tone: 'warn' };
		}
	}

	function submitManual(event: SubmitEvent) {
		event.preventDefault();
		if (manualCode.trim()) lookup(manualCode.trim());
		manualCode = '';
	}

	function queued(action: 'checkout' | 'place' | 'collect' | 'condition', formData: FormData) {
		offlineScan.enqueue(action, formData);
		takingOut = false;
		message = { text: m.scan_offline_queued(), tone: 'warn' };
	}
</script>

<svelte:head><title>{m.scan_title()}</title></svelte:head>

<div class="mx-auto flex max-w-md flex-col gap-4">
	<h1>{m.scan_title()}</h1>

	{#if data.stock && (!offlineScan.online || offlineScan.queue.length)}
		<div class="card flex flex-col gap-2 p-3 text-sm">
			{#if !offlineScan.online}
				<p class="font-medium text-amber-800">
					{m.scan_offline()}
					{#if offlineScan.catalogue}
						<span class="font-normal text-stone-500">
							· {m.scan_offline_copy({ date: formatDateTime(offlineScan.catalogue.savedAt) })}
						</span>
					{/if}
				</p>
			{/if}
			{#if offlineScan.pending.length}
				<div class="flex items-center gap-2">
					<p class="flex-1">{m.scan_offline_pending({ count: offlineScan.pending.length })}</p>
					{#if offlineScan.online}
						<button
							type="button"
							class="btn py-1"
							disabled={offlineScan.syncing}
							onclick={() => offlineScan.flush()}>{m.scan_offline_send()}</button
						>
					{/if}
				</div>
			{/if}
			{#each offlineScan.failed as entry (entry.id)}
				<div class="flex items-center gap-2 rounded-lg bg-red-50 px-2 py-1 text-red-800">
					<p class="flex-1">
						{entry.error === 'signedOut'
							? m.scan_offline_signed_out({ count: entry.count })
							: m.scan_offline_refused({ count: entry.count, date: formatDateTime(entry.at) })}
					</p>
					<button type="button" class="btn py-1" onclick={() => offlineScan.retry(entry.id)}>
						{m.scan_offline_retry()}
					</button>
					<button
						type="button"
						class="text-red-400"
						aria-label="✕"
						onclick={() => offlineScan.dismiss(entry.id)}>✕</button
					>
				</div>
			{/each}
		</div>
	{/if}

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
			role="status"
			class="rounded-lg px-3 py-2 text-sm {message.tone === 'ok'
				? 'bg-emerald-50 text-emerald-800'
				: 'bg-amber-50 text-amber-800'}"
		>
			{message.text}
		</p>
	{/if}

	{#if offlineUnit}
		<section class="flex flex-col gap-3">
			<div>
				<h2>{offlineUnit.label}</h2>
				<p class="text-sm text-stone-500">
					<span class="font-mono">{offlineUnit.code}</span>
					{#if offlineScan.catalogue}
						· {m.scan_offline_unit_note({ date: formatDateTime(offlineScan.catalogue.savedAt) })}
					{/if}
				</p>
			</div>
			{#if data.stock && data.user}
				<div class="flex flex-wrap gap-2">
					{#if keeper}
						<button type="button" class="btn" onclick={() => (puttingIn = true)}>
							{m.put_in_open()}
						</button>
					{/if}
					<button type="button" class="btn btn-primary" onclick={() => (takingOut = true)}>
						{m.take_out_open()}
					</button>
				</div>
			{/if}
			<UnitContents pieces={offlineScan.piecesIn(offlineUnit.id)}>
				{#snippet empty()}<p class="empty-state">{m.box_empty()}</p>{/snippet}
			</UnitContents>
		</section>

		{#if data.stock && data.user}
			<TakeOutSheet
				bind:open={takingOut}
				pieces={offlineScan.piecesIn(offlineUnit.id)}
				unitId={offlineUnit.id}
				role={data.user.role}
				stock={data.stock}
				form={form && ('done' in form || 'error' in form) ? form : null}
				onoffline={queued}
			/>
			{#if keeper}
				<PutInSheet
					bind:open={puttingIn}
					unitId={offlineUnit.id}
					lentPieces={offlineScan.lentPieces}
					searchable={false}
					onoffline={(formData) => queued('place', formData)}
				/>
			{/if}
		{/if}
	{:else}
		<p class="text-sm text-stone-600">{m.scan_help()}</p>
	{/if}
</div>
