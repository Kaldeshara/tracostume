<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import {
		conditionLabel,
		formatDate,
		formatDateTime,
		isOverdue,
		movementLabel
	} from '#lib/format.ts';
	import { canManageStock, hasRole } from '#lib/roles.ts';
	import { categoryLabel } from '#lib/categories.ts';
	import { selection } from '#lib/selection.svelte.ts';
	import ConditionBadge from '#lib/components/ConditionBadge.svelte';
	import Location from '#lib/components/Location.svelte';
	import PhotoInput from '#lib/components/PhotoInput.svelte';
	import StockActions from '#lib/components/StockActions.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const item = $derived(data.item);
	const keeper = $derived(canManageStock(data.user?.role));
	let photoIndex = $state(0);
	const currentPhoto = $derived(item.photoIds[Math.min(photoIndex, item.photoIds.length - 1)]);
	const selected = $derived(selection.has(item.id));

	function confirmDelete(event: SubmitEvent) {
		if (!confirm(m.item_delete_confirm())) event.preventDefault();
	}
</script>

<svelte:head><title>{item.name}</title></svelte:head>

<div class="grid gap-6 md:grid-cols-2">
	<section>
		<div class="card aspect-square overflow-hidden bg-stone-100">
			{#if currentPhoto}
				<img src="/photos/{currentPhoto}" alt={item.name} class="h-full w-full object-contain" />
			{:else}
				<div class="flex h-full items-center justify-center text-7xl text-stone-300">👗</div>
			{/if}
		</div>
		{#if item.photoIds.length > 1 || keeper}
			<div class="mt-2 flex flex-wrap gap-2">
				{#each item.photoIds as photoId, index (photoId)}
					<div class="relative">
						<button
							type="button"
							class="h-16 w-16 overflow-hidden rounded-lg border-2 {photoId === currentPhoto
								? 'border-brand-600'
								: 'border-transparent'}"
							onclick={() => (photoIndex = index)}
						>
							<img src="/photos/{photoId}" alt="" class="h-full w-full object-cover" />
						</button>
						{#if keeper && photoId === currentPhoto}
							<form
								method="POST"
								action="?/deletePhoto"
								use:enhance
								class="absolute -top-2 -right-2"
							>
								<input type="hidden" name="photoId" value={photoId} />
								<button
									class="h-6 w-6 rounded-full bg-red-600 text-xs text-white shadow"
									aria-label={m.photo_delete()}>✕</button
								>
							</form>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
		{#if keeper}
			<form
				method="POST"
				action="?/addPhotos"
				enctype="multipart/form-data"
				use:enhance
				class="mt-3 flex flex-col gap-2"
			>
				<PhotoInput />
				<button class="btn self-start">{m.photo_add()}</button>
			</form>
		{/if}
	</section>

	<section class="flex flex-col gap-4">
		<div>
			<div class="flex items-start gap-3">
				<h1 class="flex-1">{item.name}</h1>
				<button
					type="button"
					class="btn {selected ? 'btn-primary' : ''}"
					onclick={() => selection.toggle(item.id)}
				>
					{selected ? m.selection_remove() : m.selection_add()}
				</button>
			</div>
			<div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
				<span class="chip bg-stone-100 font-mono">{item.code}</span>
				<ConditionBadge condition={item.condition} />
				{#each item.tags as tag (tag)}
					<a href="/items?q={encodeURIComponent(tag)}" class="chip bg-brand-50 text-brand-800"
						>#{tag}</a
					>
				{/each}
			</div>
		</div>

		<div class="card p-4">
			<h2 class="mb-2 text-sm text-stone-500 uppercase">{m.item_where()}</h2>
			<Location {item} />
			{#if item.loan}
				<dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
					<dt class="text-stone-500">{m.loan_since()}</dt>
					<dd>{formatDate(item.loan.checkedOutAt)}</dd>
					{#if item.loan.dueAt}
						<dt class="text-stone-500">{m.field_due_at()}</dt>
						<dd class={isOverdue(item.loan.dueAt) ? 'font-semibold text-red-700' : ''}>
							{formatDate(item.loan.dueAt)}
							{#if isOverdue(item.loan.dueAt)}({m.loan_overdue()}){/if}
						</dd>
					{/if}
					{#if item.loanDetails?.reason}
						<dt class="text-stone-500">{m.field_reason()}</dt>
						<dd>{item.loanDetails.reason}</dd>
					{/if}
					{#if item.loanDetails?.phone}
						<dt class="text-stone-500">{m.field_phone()}</dt>
						<dd>
							<a class="link" href="tel:{item.loanDetails.phone}">{item.loanDetails.phone}</a>
						</dd>
					{/if}
				</dl>
			{/if}
		</div>

		{#if keeper && data.stock}
			<StockActions
				itemIds={[item.id]}
				boxes={data.stock.boxes}
				users={data.stock.users}
				defaultBoxId={data.defaultBoxId}
				someOut={!!item.loan}
				allOut={!!item.loan}
				{form}
			/>
		{/if}

		<dl class="card grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-4 text-sm">
			<dt class="text-stone-500">{m.field_category()}</dt>
			<dd>{categoryLabel(item.category)}</dd>
			{#if item.color}<dt class="text-stone-500">{m.field_color()}</dt>
				<dd>{item.color}</dd>{/if}
			{#if item.size}<dt class="text-stone-500">{m.field_size()}</dt>
				<dd>{item.size}</dd>{/if}
			{#if item.description}
				<dt class="text-stone-500">{m.field_description()}</dt>
				<dd class="whitespace-pre-line">{item.description}</dd>
			{/if}
		</dl>

		<div class="card flex items-center gap-4 p-4">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- QR SVG generated by the server -->
			<div class="h-28 w-28 shrink-0">{@html data.qr}</div>
			<div class="flex flex-col gap-2 text-sm">
				<span class="font-mono text-lg">{item.code}</span>
				{#if keeper}
					<a class="link" href="/labels?items={item.id}">{m.labels_print()}</a>
					<a class="link" href="/items/{item.id}/edit">{m.item_edit()}</a>
				{/if}
			</div>
		</div>

		<section>
			<h2 class="mb-2">{m.item_history()}</h2>
			<ol class="card divide-y divide-stone-100 text-sm">
				{#each data.movements as movement (movement.id)}
					<li class="flex flex-col gap-0.5 px-4 py-2">
						<div class="flex flex-wrap gap-x-2">
							<span class="font-medium">{movementLabel(movement.type)}</span>
							{#if movement.fromBox}
								<span class="text-stone-500">{movement.fromBox.code} →</span>
							{/if}
							{#if movement.toBox}<span>{movement.toBox.code} · {movement.toBox.label}</span>{/if}
							{#if movement.loan}
								<span>
									{movement.type === 'CHECKED_OUT' ? '→' : '←'}
									{movement.loan.borrowerUser
										? `${movement.loan.borrowerUser.firstName} ${movement.loan.borrowerUser.lastName}`
										: movement.loan.borrowerName}
								</span>
							{/if}
							{#if movement.toCondition}
								<span>{conditionLabel(movement.toCondition)}</span>
							{/if}
						</div>
						<div class="text-xs text-stone-500">
							{formatDateTime(movement.createdAt)}
							{#if movement.user}· {movement.user.firstName} {movement.user.lastName}{/if}
							{#if movement.note}· {movement.note}{/if}
						</div>
					</li>
				{:else}
					<li class="px-4 py-2 text-stone-500">{m.item_history_empty()}</li>
				{/each}
			</ol>
		</section>

		{#if hasRole(data.user?.role, 'ADMIN')}
			<form method="POST" action="?/delete" onsubmit={confirmDelete}>
				<button class="btn btn-danger">{m.item_delete()}</button>
			</form>
		{/if}
	</section>
</div>
