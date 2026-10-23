<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import { canManageStock } from '#lib/roles.ts';
	import BoxFields from '#lib/components/BoxFields.svelte';
	import { KIND_ICONS } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let creating = $state(false);
	let filter = $state('');

	const matches = (box: {
		code: string;
		label: string;
		shelf: string | null;
		description: string | null;
	}) => {
		const text =
			`${box.code} ${box.label} ${box.shelf ?? ''} ${box.description ?? ''}`.toLowerCase();
		return text.includes(filter.trim().toLowerCase());
	};
</script>

<svelte:head><title>{m.boxes_title()}</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="flex-1">{m.boxes_title()}</h1>
	<a href="/map" class="btn">{m.nav_map()}</a>
	{#if canManageStock(data.user?.role)}
		<button type="button" class="btn btn-primary" onclick={() => (creating = !creating)}>
			+ {m.box_new()}
		</button>
	{/if}
</div>

{#if creating || form?.invalid}
	<form method="POST" action="?/create" use:enhance class="card mb-6 flex flex-col gap-3 p-4">
		<h2>{m.box_new()}</h2>
		<BoxFields values={form?.values} />
		{#if form?.invalid}<p class="text-sm text-red-700">{m.form_invalid()}</p>{/if}
		<button class="btn btn-primary self-start">{m.action_create()}</button>
	</form>
{/if}

<input class="input mb-4" type="search" bind:value={filter} placeholder={m.boxes_filter()} />

{#each data.containers as container (container.id)}
	<section class="mb-6">
		<h2 class="mb-2">{container.name}</h2>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each container.boxes.filter(matches) as box (box.id)}
				<a href="/boxes/{box.id}" class="card flex items-center gap-3 p-4 hover:border-brand-200">
					<span class="text-3xl">{KIND_ICONS[box.kind]}</span>
					<div class="min-w-0 flex-1">
						<div class="truncate font-medium">{box.label}</div>
						<div class="text-xs text-stone-500">
							<span class="font-mono">{box.code}</span>
							{#if box.shelf}· {box.shelf}{/if}
						</div>
					</div>
					<span class="chip bg-stone-100 text-stone-700"
						>{m.box_item_count({ count: box._count.items })}</span
					>
				</a>
			{/each}
		</div>
	</section>
{:else}
	<p class="card p-8 text-center text-stone-500">{m.boxes_empty()}</p>
{/each}
