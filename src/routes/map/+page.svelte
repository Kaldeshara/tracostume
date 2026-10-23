<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { hasRole } from '#lib/roles.ts';
	import { DEFAULT_BOX, freeFloorSpot, stackHeight, type Placed } from '#lib/map.ts';
	import ContainerMap, { type MapBox } from '#lib/components/ContainerMap.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Box = (typeof data.boxes)[number];

	// Local copy: edits apply immediately in the scene and are saved in the background.
	// svelte-ignore state_referenced_locally
	let boxes = $state<Box[]>(structuredClone(data.boxes));
	// svelte-ignore state_referenced_locally
	let selectedId = $state<string | null>(data.initialBoxId);
	let saving = $state<string | null>(null);
	let saveError = $state(false);

	const dims = (box: Box) => ({
		widthCm: box.widthCm ?? DEFAULT_BOX.widthCm,
		depthCm: box.depthCm ?? DEFAULT_BOX.depthCm,
		heightCm: box.heightCm ?? DEFAULT_BOX.heightCm
	});
	const isPlaced = (box: Box) => box.posXCm != null && box.posYCm != null;

	const placed = $derived<(MapBox & Placed)[]>(
		boxes.filter(isPlaced).map((box) => ({
			id: box.id,
			code: box.code,
			label: box.label,
			shelf: box.shelf,
			posXCm: box.posXCm!,
			posYCm: box.posYCm!,
			posZCm: box.posZCm ?? 0,
			...dims(box)
		}))
	);
	const unplaced = $derived(boxes.filter((box) => !isPlaced(box)));
	const selected = $derived(boxes.find((box) => box.id === selectedId) ?? null);
	const highlightedBoxes = $derived(
		boxes
			.filter((box) => data.highlighted[box.id])
			.map((box) => ({ box, count: data.highlighted[box.id] }))
	);

	async function save(box: Box) {
		saving = box.id;
		saveError = false;
		try {
			const response = await fetch(`/map/boxes/${box.id}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					posXCm: box.posXCm,
					posYCm: box.posYCm,
					posZCm: box.posZCm,
					widthCm: box.widthCm,
					depthCm: box.depthCm,
					heightCm: box.heightCm
				})
			});
			saveError = !response.ok;
		} catch {
			saveError = true;
		} finally {
			saving = null;
		}
	}

	function onmove(id: string, pos: { posXCm: number; posYCm: number }) {
		const box = boxes.find((other) => other.id === id);
		if (!box) return;
		Object.assign(box, pos);
		selectedId = id;
		save(box);
	}

	function place(box: Box) {
		const spot = freeFloorSpot({ id: box.id, ...dims(box) }, placed, data.container);
		Object.assign(box, { ...spot, posZCm: 0, ...dims(box) });
		selectedId = box.id;
		save(box);
	}

	function unplace(box: Box) {
		Object.assign(box, { posXCm: null, posYCm: null, posZCm: null });
		selectedId = null;
		save(box);
	}

	function stack(box: Box) {
		const me = placed.find((other) => other.id === box.id);
		if (!me) return;
		box.posZCm = Math.min(stackHeight(me, placed), data.container.heightCm - me.heightCm);
		save(box);
	}

	function setField(
		box: Box,
		key: 'posXCm' | 'posYCm' | 'posZCm' | 'widthCm' | 'depthCm' | 'heightCm',
		event: Event & { currentTarget: HTMLInputElement }
	) {
		const value = Math.round(Number(event.currentTarget.value));
		if (!Number.isFinite(value) || value < 0) return;
		box[key] = value;
		save(box);
	}

	const geometryFields = [
		['posXCm', m.field_pos_x],
		['posYCm', m.field_pos_y],
		['posZCm', m.field_pos_z],
		['widthCm', m.field_width],
		['depthCm', m.field_depth],
		['heightCm', m.field_height]
	] as const;
</script>

<svelte:head><title>{m.map_title()}</title></svelte:head>

<div class="mb-3 flex flex-wrap items-center gap-3">
	<h1 class="flex-1">{m.map_title()}</h1>
	{#if saving}<span class="text-sm text-stone-500">{m.map_saving()}</span>{/if}
	{#if saveError}<span class="text-sm text-red-700">{m.map_save_error()}</span>{/if}
</div>

{#if !data.measured}
	<p class="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
		{m.map_not_measured()}
		{#if hasRole(data.user?.role, 'ADMIN')}
			<a class="link ml-1" href="/container">{m.map_set_dimensions()}</a>
		{/if}
	</p>
{/if}

<div class="grid gap-4 md:grid-cols-[1fr_320px]">
	<div class="h-[55vh] min-h-80 md:h-[70vh]">
		<ContainerMap
			container={data.container}
			boxes={placed}
			highlighted={data.highlighted}
			bind:selectedId
			editable={data.editable}
			{onmove}
		/>
	</div>

	<aside class="flex flex-col gap-4">
		<p class="text-sm text-stone-600">
			{data.editable ? m.map_help_editable() : m.map_help_readonly()}
		</p>

		{#if highlightedBoxes.length}
			<section class="card p-3">
				<h2 class="mb-2 text-sm">{m.map_your_items()}</h2>
				<ul class="flex flex-col gap-1 text-sm">
					{#each highlightedBoxes as { box, count } (box.id)}
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-stone-100 {box.id ===
								selectedId
									? 'bg-brand-50'
									: ''}"
								onclick={() => (selectedId = box.id)}
							>
								<span class="chip bg-brand-700 text-white">{count}</span>
								<span class="font-mono">{box.code}</span>
								<span class="truncate">{box.label}</span>
								{#if !isPlaced(box)}
									<span class="ml-auto text-xs text-stone-500">{m.map_unplaced()}</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="card p-3">
			{#if selected}
				<div class="flex items-start gap-2">
					<div class="min-w-0 flex-1">
						<div class="font-mono text-xs text-stone-500">{selected.code}</div>
						<h2 class="truncate">{selected.label}</h2>
						{#if selected.shelf}<div class="text-sm text-stone-500">{selected.shelf}</div>{/if}
						<div class="text-sm text-stone-500">
							{m.box_item_count({ count: selected.itemCount })}
						</div>
					</div>
					<button
						type="button"
						class="text-stone-400"
						aria-label={m.action_cancel()}
						onclick={() => (selectedId = null)}>✕</button
					>
				</div>
				{#if data.highlighted[selected.id]}
					<p class="mt-2 text-sm font-medium text-brand-700">
						{m.map_selected_items_here({ count: data.highlighted[selected.id] })}
					</p>
				{/if}
				<a class="btn mt-3" href="/boxes/{selected.id}">{m.map_open_box()}</a>

				{#if data.editable}
					{#if isPlaced(selected)}
						<div class="mt-4 grid grid-cols-3 gap-2">
							{#each geometryFields as [key, label] (key)}
								<div>
									<label class="label text-xs" for="geo-{key}">{label()}</label>
									<input
										class="input"
										id="geo-{key}"
										type="number"
										min="0"
										inputmode="numeric"
										value={selected[key] ??
											(key.endsWith('Cm') && key.startsWith('pos')
												? 0
												: DEFAULT_BOX[key as keyof typeof DEFAULT_BOX])}
										onchange={(event) => setField(selected!, key, event)}
									/>
								</div>
							{/each}
						</div>
						<div class="mt-3 flex flex-wrap gap-2">
							<button type="button" class="btn" onclick={() => stack(selected!)}>
								{m.map_stack()}
							</button>
							<button type="button" class="btn btn-danger" onclick={() => unplace(selected!)}>
								{m.map_unplace()}
							</button>
						</div>
					{:else}
						<button type="button" class="btn btn-primary mt-3" onclick={() => place(selected!)}>
							{m.map_place()}
						</button>
					{/if}
				{/if}
			{:else}
				<p class="text-sm text-stone-500">
					{placed.length ? m.map_nothing_selected() : m.map_none_placed()}
				</p>
			{/if}
		</section>

		{#if unplaced.length}
			<section class="card p-3">
				<h2 class="mb-2 text-sm">{m.map_unplaced()} ({unplaced.length})</h2>
				<ul class="flex flex-col gap-1 text-sm">
					{#each unplaced as box (box.id)}
						<li class="flex items-center gap-2">
							<button
								type="button"
								class="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left hover:bg-stone-100 {box.id ===
								selectedId
									? 'bg-brand-50'
									: ''}"
								onclick={() => (selectedId = box.id)}
							>
								<span class="font-mono">{box.code}</span>
								<span class="truncate">{box.label}</span>
							</button>
							{#if data.editable}
								<button type="button" class="btn px-2 py-1 text-xs" onclick={() => place(box)}>
									{m.map_place()}
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</aside>
</div>
