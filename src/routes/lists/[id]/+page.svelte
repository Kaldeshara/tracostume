<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate, toDateInput } from '#lib/format.ts';
	import { canEditLists } from '#lib/roles.ts';
	import { selection } from '#lib/selection.svelte.ts';
	import ItemCard from '#lib/components/ItemCard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const list = $derived(data.list);
	const canEdit = $derived(canEditLists(data.user?.role));
	const ids = $derived(data.items.map((item) => item.id));
	const outCount = $derived(data.items.filter((item) => item.loan).length);
	const inCount = $derived(data.items.filter((item) => !item.loan && item.box).length);
	// Selected pieces that are not in the list yet.
	const toAdd = $derived(selection.ids.filter((id) => !ids.includes(id)));

	function selectAll() {
		selection.add(...ids);
		goto('/selection');
	}

	function confirmDelete(event: SubmitEvent) {
		if (!confirm(m.lists_delete_confirm())) event.preventDefault();
	}
</script>

<svelte:head><title>{list.name}</title></svelte:head>

<div class="mb-1 text-sm"><a href="/lists" class="link">← {m.lists_title()}</a></div>
<div class="mb-2 flex flex-wrap items-center gap-2">
	<h1 class="flex-1">{list.name}</h1>
	<span class="chip bg-brand-50 text-brand-800">
		{list.kind === 'SET' ? m.lists_kind_set() : m.lists_kind_show()}
	</span>
</div>
<p class="mb-4 text-sm text-stone-600">
	{#if list.date}{formatDate(list.date)} ·{/if}
	{m.lists_piece_count({ count: data.items.length })}
	· {m.group_in({ count: inCount })}
	{#if outCount}· {m.group_out({ count: outCount })}{/if}
	{#if list.createdBy}· {m.lists_by({ name: list.createdBy.firstName })}{/if}
</p>
{#if list.description}<p class="mb-4 whitespace-pre-line">{list.description}</p>{/if}

<div class="mb-6 flex flex-wrap gap-2">
	{#if data.items.length}
		<button type="button" class="btn btn-primary" onclick={selectAll}>{m.lists_select_all()}</button
		>
	{/if}
	{#if canEdit && toAdd.length}
		<form method="POST" action="?/addItems" use:enhance>
			{#each toAdd as id (id)}<input type="hidden" name="itemId" value={id} />{/each}
			<button class="btn">{m.lists_add_selection({ count: toAdd.length })}</button>
		</form>
	{/if}
</div>
{#if form?.added !== undefined}
	<p class="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
		{m.lists_added({ count: form.added })}
	</p>
{/if}

{#if !data.items.length}
	<div class="card mb-6 p-8 text-center text-stone-500">{m.lists_no_pieces()}</div>
{:else}
	<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
		{#each data.items as item (item.id)}
			<div class="flex flex-col gap-1">
				<ItemCard {item} selectable />
				{#if canEdit}
					<form method="POST" action="?/removeItems" use:enhance>
						<input type="hidden" name="itemId" value={item.id} />
						<button class="w-full text-xs text-stone-500 hover:text-red-700">
							{m.lists_remove_piece()}
						</button>
					</form>
				{/if}
			</div>
		{/each}
	</div>
{/if}

{#if canEdit}
	<details class="card p-4">
		<summary class="cursor-pointer font-medium">{m.lists_edit()}</summary>
		<form method="POST" action="?/update" use:enhance class="mt-3 flex flex-col gap-3">
			<div class="grid gap-3 sm:grid-cols-2">
				<div>
					<label class="label" for="name">{m.lists_name()}</label>
					<input class="input" id="name" name="name" required maxlength="120" value={list.name} />
				</div>
				<div>
					<label class="label" for="kind">{m.lists_kind()}</label>
					<select class="input" id="kind" name="kind" value={list.kind}>
						<option value="SHOW">{m.lists_kind_show()}</option>
						<option value="SET">{m.lists_kind_set()}</option>
					</select>
				</div>
				<div>
					<label class="label" for="date">{m.lists_date()}</label>
					<input class="input" id="date" name="date" type="date" value={toDateInput(list.date)} />
				</div>
			</div>
			<div>
				<label class="label" for="description">{m.lists_description()}</label>
				<textarea
					class="input"
					id="description"
					name="description"
					rows="3"
					maxlength="1000"
					value={list.description ?? ''}></textarea>
			</div>
			{#if form?.invalid}<p class="text-sm text-red-700">{m.lists_invalid()}</p>{/if}
			{#if form?.saved}<p class="text-sm text-emerald-700">{m.lists_saved()}</p>{/if}
			<button class="btn btn-primary self-start">{m.action_save()}</button>
		</form>
		<form method="POST" action="?/delete" class="mt-4" onsubmit={confirmDelete}>
			<button class="btn btn-danger">{m.lists_delete()}</button>
		</form>
	</details>
{/if}
