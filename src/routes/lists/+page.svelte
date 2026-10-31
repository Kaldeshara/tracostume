<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate } from '#lib/format.ts';
	import { canEditLists } from '#lib/roles.ts';
	import { selection } from '#lib/selection.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const canEdit = $derived(canEditLists(data.user?.role));
	// Opened from the selection page ("Save as a list"): the new list starts with the selection.
	let withSelection = $state(page.url.searchParams.has('fromSelection'));
	let creating = $state(page.url.searchParams.has('fromSelection'));

	const sections = $derived([
		{ title: m.lists_shows(), lists: data.lists.filter((list) => list.kind === 'SHOW') },
		{ title: m.lists_sets(), lists: data.lists.filter((list) => list.kind === 'SET') }
	]);
</script>

<svelte:head><title>{m.lists_title()}</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="flex-1">{m.lists_title()}</h1>
	{#if canEdit && !creating}
		<button type="button" class="btn btn-primary" onclick={() => (creating = true)}>
			{m.lists_new()}
		</button>
	{/if}
</div>
<p class="mb-4 text-sm text-stone-600">{m.lists_help()}</p>

{#if canEdit && creating}
	<form method="POST" action="?/create" use:enhance class="card mb-6 flex flex-col gap-3 p-4">
		<h2>{m.lists_new()}</h2>
		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<label class="label" for="name">{m.lists_name()}</label>
				<input class="input" id="name" name="name" required maxlength="120" />
			</div>
			<div>
				<label class="label" for="kind">{m.lists_kind()}</label>
				<select class="input" id="kind" name="kind">
					<option value="SHOW">{m.lists_kind_show()}</option>
					<option value="SET">{m.lists_kind_set()}</option>
				</select>
			</div>
			<div>
				<label class="label" for="date">{m.lists_date()}</label>
				<input class="input" id="date" name="date" type="date" />
			</div>
			<div>
				<label class="label" for="description">{m.lists_description()}</label>
				<input class="input" id="description" name="description" maxlength="1000" />
			</div>
		</div>
		{#if selection.size}
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" class="rounded" bind:checked={withSelection} />
				{m.lists_with_selection({ count: selection.size })}
			</label>
			{#if withSelection}
				{#each selection.ids as id (id)}<input type="hidden" name="itemId" value={id} />{/each}
			{/if}
		{/if}
		{#if form?.invalid}<p class="text-sm text-red-700">{m.lists_invalid()}</p>{/if}
		<div class="flex gap-2">
			<button class="btn btn-primary">{m.action_save()}</button>
			<button type="button" class="btn" onclick={() => (creating = false)}>
				{m.action_cancel()}
			</button>
		</div>
	</form>
{/if}

{#if !data.lists.length}
	<div class="card p-8 text-center text-stone-500">{m.lists_empty()}</div>
{/if}

{#each sections as section (section.title)}
	{#if section.lists.length}
		<h2 class="mt-6 mb-2">{section.title}</h2>
		<ul class="card divide-y divide-stone-100">
			{#each section.lists as list (list.id)}
				<li>
					<a href="/lists/{list.id}" class="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
						<div class="min-w-0 flex-1">
							<div class="truncate font-medium">{list.name}</div>
							<div class="text-xs text-stone-500">
								{#if list.date}{formatDate(list.date)} ·{/if}
								{m.lists_piece_count({ count: list.count })}
								{#if list.createdBy}· {list.createdBy.firstName}{/if}
							</div>
						</div>
						{#if list.outCount}
							<span class="chip bg-violet-100 text-violet-800">
								{m.group_out({ count: list.outCount })}
							</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
{/each}
