<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { BoxKind, DoorSide } from '../../generated/prisma/enums';
	import { hasRole } from '#lib/roles.ts';
	import { doorSideLabel, kindLabel, KIND_ICONS } from '#lib/format.ts';
	import {
		BOX_KINDS,
		DOOR_SIDES,
		freeFloorSpot,
		KIND_DEFAULTS,
		nearestRestLevel,
		type Placed
	} from '#lib/map.ts';
	import ContainerMap, { type MapBox } from '#lib/components/ContainerMap.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Box = (typeof data.boxes)[number];

	// Local copies: edits apply immediately in the scene and are saved in the background.
	// svelte-ignore state_referenced_locally
	let boxes = $state<Box[]>(structuredClone(data.boxes));
	// svelte-ignore state_referenced_locally
	let container = $state(structuredClone(data.container));
	// svelte-ignore state_referenced_locally
	let measured = $state(data.measured);
	// svelte-ignore state_referenced_locally
	let selectedId = $state<string | null>(data.initialBoxId);
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let editingContainer = $state(false);
	let adding = $state(false);
	let newLabel = $state('');
	let newKind = $state<BoxKind>('PLASTIC_BOX');

	const dims = (box: Box) => ({
		widthCm: box.widthCm ?? KIND_DEFAULTS[box.kind].widthCm,
		depthCm: box.depthCm ?? KIND_DEFAULTS[box.kind].depthCm,
		heightCm: box.heightCm ?? KIND_DEFAULTS[box.kind].heightCm
	});
	const isPlaced = (box: Box) => box.posXCm != null && box.posYCm != null;

	const placed = $derived<(MapBox & Placed)[]>(
		boxes.filter(isPlaced).map((box) => ({
			id: box.id,
			code: box.code,
			label: box.label,
			shelf: box.shelf,
			kind: box.kind,
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

	async function request(url: string, method: string, body: unknown) {
		saving = true;
		saveError = null;
		try {
			const response = await fetch(url, {
				method,
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!response.ok) {
				saveError = response.status === 409 ? m.map_delete_not_empty() : m.map_save_error();
				return null;
			}
			return response;
		} catch {
			saveError = m.map_save_error();
			return null;
		} finally {
			saving = false;
		}
	}

	const saveBox = (box: Box) =>
		request(`/map/boxes/${box.id}`, 'PUT', {
			label: box.label,
			kind: box.kind,
			posXCm: box.posXCm,
			posYCm: box.posYCm,
			posZCm: box.posZCm,
			widthCm: box.widthCm,
			depthCm: box.depthCm,
			heightCm: box.heightCm
		});

	/** Puts the unit on the surface closest to its current height (floor, box top). */
	function rest(box: Box) {
		const me = placed.find((other) => other.id === box.id);
		if (me) box.posZCm = nearestRestLevel(me, placed);
	}

	function onmove(id: string, pos: { posXCm: number; posYCm: number }) {
		const box = boxes.find((other) => other.id === id);
		if (!box) return;
		Object.assign(box, pos);
		rest(box);
		selectedId = id;
		saveBox(box);
	}

	function place(box: Box) {
		const spot = freeFloorSpot({ id: box.id, ...dims(box) }, placed, container);
		Object.assign(box, { ...spot, posZCm: 0, ...dims(box) });
		selectedId = box.id;
		saveBox(box);
	}

	function unplace(box: Box) {
		Object.assign(box, { posXCm: null, posYCm: null, posZCm: null });
		selectedId = null;
		saveBox(box);
	}

	function setKind(box: Box, kind: BoxKind) {
		const wasDefault =
			box.widthCm === KIND_DEFAULTS[box.kind].widthCm &&
			box.depthCm === KIND_DEFAULTS[box.kind].depthCm &&
			box.heightCm === KIND_DEFAULTS[box.kind].heightCm;
		box.kind = kind;
		// Sizes that were just the old kind's defaults follow the new kind.
		if (wasDefault || box.widthCm == null) Object.assign(box, KIND_DEFAULTS[kind]);
		if (isPlaced(box)) rest(box);
		saveBox(box);
	}

	function setField(
		box: Box,
		key: 'posXCm' | 'posYCm' | 'posZCm' | 'widthCm' | 'depthCm' | 'heightCm',
		event: Event & { currentTarget: HTMLInputElement }
	) {
		const value = Math.round(Number(event.currentTarget.value));
		if (!Number.isFinite(value) || value < 0) return;
		box[key] = value;
		saveBox(box);
	}

	function setLabel(box: Box, event: Event & { currentTarget: HTMLInputElement }) {
		const value = event.currentTarget.value.trim();
		if (!value || value === box.label) return;
		box.label = value;
		saveBox(box);
	}

	async function addUnit() {
		const label = newLabel.trim();
		if (!label) return;
		const defaults = KIND_DEFAULTS[newKind];
		const spot = freeFloorSpot({ id: 'new', ...defaults }, placed, container);
		const response = await request('/map/boxes', 'POST', {
			label,
			kind: newKind,
			...defaults,
			...spot,
			posZCm: 0
		});
		if (!response) return;
		const created = (await response.json()) as Box;
		boxes.push(created);
		selectedId = created.id;
		newLabel = '';
		adding = false;
	}

	async function deleteUnit(box: Box) {
		if (!confirm(m.map_delete_confirm())) return;
		const response = await request(`/map/boxes/${box.id}`, 'DELETE', undefined);
		if (!response) return;
		boxes = boxes.filter((other) => other.id !== box.id);
		selectedId = null;
	}

	async function saveContainer(event: SubmitEvent) {
		event.preventDefault();
		const form = new FormData(event.currentTarget as HTMLFormElement);
		const next = {
			name: String(form.get('name') ?? '').trim() || container.name,
			widthCm: Math.round(Number(form.get('widthCm'))),
			depthCm: Math.round(Number(form.get('depthCm'))),
			heightCm: Math.round(Number(form.get('heightCm'))),
			doorSide: String(form.get('doorSide')) as DoorSide
		};
		if ([next.widthCm, next.depthCm, next.heightCm].some((v) => !Number.isFinite(v) || v < 50)) {
			saveError = m.form_invalid();
			return;
		}
		const response = await request('/map/container', 'PUT', next);
		if (!response) return;
		container = next;
		measured = true;
		editingContainer = false;
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
	{#if saveError}<span class="text-sm text-red-700">{saveError}</span>{/if}
</div>

<div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
	<div class="relative h-[60vh] min-h-80 min-w-0 md:h-[75vh]">
		<ContainerMap
			{container}
			boxes={placed}
			highlighted={data.highlighted}
			bind:selectedId
			editable={data.editable}
			{onmove}
		/>
		{#if selected}
			<div
				class="absolute inset-x-2 bottom-2 max-h-[60%] overflow-y-auto rounded-xl bg-white/95 p-3 shadow-lg ring-1 ring-black/10 backdrop-blur md:hidden"
			>
				{@render selectedPanel('sheet')}
			</div>
		{/if}
	</div>

	<aside class="flex flex-col gap-4">
		<section class="card p-3">
			<div class="flex items-start gap-2">
				<div class="min-w-0 flex-1">
					<h2 class="truncate">{container.name}</h2>
					<p class="text-sm text-stone-600">
						{container.widthCm} × {container.depthCm} × {container.heightCm} cm ·
						{m.field_door_side()} : {doorSideLabel(container.doorSide).toLowerCase()}
					</p>
					{#if !measured}
						<p class="mt-1 text-xs text-amber-700">{m.map_not_measured()}</p>
					{/if}
				</div>
				{#if data.editable}
					<button
						type="button"
						class="btn px-2 py-1 text-xs"
						onclick={() => (editingContainer = !editingContainer)}
					>
						{m.action_edit()}
					</button>
				{/if}
			</div>
			{#if editingContainer}
				<form class="mt-3 flex flex-col gap-2" onsubmit={saveContainer}>
					<input class="input" name="name" value={container.name} aria-label={m.field_name()} />
					<div class="grid grid-cols-3 gap-2">
						{#each [['widthCm', m.field_width], ['depthCm', m.field_depth], ['heightCm', m.field_height]] as const as [key, label] (key)}
							<div>
								<label class="label text-xs" for="container-{key}">{label()}</label>
								<input
									class="input"
									id="container-{key}"
									name={key}
									type="number"
									min="50"
									inputmode="numeric"
									value={container[key]}
								/>
							</div>
						{/each}
					</div>
					<div>
						<label class="label text-xs" for="container-door">{m.field_door_side()}</label>
						<select class="input" id="container-door" name="doorSide" value={container.doorSide}>
							{#each DOOR_SIDES as side (side)}
								<option value={side}>{doorSideLabel(side)}</option>
							{/each}
						</select>
					</div>
					<p class="text-xs text-stone-500">{m.container_dimensions_hint()}</p>
					<div class="flex gap-2">
						<button class="btn btn-primary">{m.action_save()}</button>
						<button type="button" class="btn" onclick={() => (editingContainer = false)}>
							{m.action_cancel()}
						</button>
					</div>
				</form>
			{/if}
		</section>

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
								<span>{KIND_ICONS[box.kind]}</span>
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

		<!-- On phones the selected unit shows in a sheet over the map (see below). -->
		<section class="card hidden p-3 md:block">{@render selectedPanel('side')}</section>

		{#if data.editable}
			<section class="card p-3">
				{#if adding}
					<form
						class="flex flex-col gap-2"
						onsubmit={(event) => {
							event.preventDefault();
							addUnit();
						}}
					>
						<h2 class="text-sm">{m.map_add_unit()}</h2>
						<input
							class="input"
							bind:value={newLabel}
							placeholder={m.field_label()}
							required
							aria-label={m.field_label()}
						/>
						<select class="input" bind:value={newKind} aria-label={m.field_kind()}>
							{#each BOX_KINDS as kind (kind)}
								<option value={kind}>{KIND_ICONS[kind]} {kindLabel(kind)}</option>
							{/each}
						</select>
						<div class="flex gap-2">
							<button class="btn btn-primary">{m.map_add()}</button>
							<button type="button" class="btn" onclick={() => (adding = false)}>
								{m.action_cancel()}
							</button>
						</div>
					</form>
				{:else}
					<button type="button" class="btn w-full" onclick={() => (adding = true)}>
						+ {m.map_add_unit()}
					</button>
				{/if}
			</section>
		{/if}

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
								<span>{KIND_ICONS[box.kind]}</span>
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

{#snippet selectedPanel(prefix: string)}
	{#if selected}
		<div class="flex items-start gap-2">
			<span class="text-2xl">{KIND_ICONS[selected.kind]}</span>
			<div class="min-w-0 flex-1">
				<div class="font-mono text-xs text-stone-500">
					{selected.code} · {kindLabel(selected.kind)}
				</div>
				{#if data.editable}
					<input
						class="input mt-1 font-semibold"
						value={selected.label}
						aria-label={m.field_label()}
						onchange={(event) => setLabel(selected!, event)}
					/>
				{:else}
					<h2 class="truncate">{selected.label}</h2>
				{/if}
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
			<div class="mt-3">
				<label class="label text-xs" for="{prefix}-unit-kind">{m.field_kind()}</label>
				<select
					class="input"
					id="{prefix}-unit-kind"
					value={selected.kind}
					onchange={(event) => setKind(selected!, event.currentTarget.value as BoxKind)}
				>
					{#each BOX_KINDS as kind (kind)}
						<option value={kind}>{KIND_ICONS[kind]} {kindLabel(kind)}</option>
					{/each}
				</select>
			</div>
			{#if isPlaced(selected)}
				<div class="mt-3 grid grid-cols-3 gap-2">
					{#each geometryFields as [key, label] (key)}
						<div>
							<label class="label text-xs" for="{prefix}-geo-{key}">{label()}</label>
							<input
								class="input"
								id="{prefix}-geo-{key}"
								type="number"
								min="0"
								inputmode="numeric"
								value={selected[key] ??
									(key.startsWith('pos')
										? 0
										: KIND_DEFAULTS[selected.kind][key as 'widthCm' | 'depthCm' | 'heightCm'])}
								onchange={(event) => setField(selected!, key, event)}
							/>
						</div>
					{/each}
				</div>
				<div class="mt-3 flex flex-wrap gap-2">
					<button
						type="button"
						class="btn"
						onclick={() => {
							rest(selected!);
							saveBox(selected!);
						}}
					>
						{m.map_stack()}
					</button>
					<button type="button" class="btn" onclick={() => unplace(selected!)}>
						{m.map_unplace()}
					</button>
					{#if hasRole(data.user?.role, 'ADMIN')}
						<button type="button" class="btn btn-danger" onclick={() => deleteUnit(selected!)}>
							{m.map_delete_unit()}
						</button>
					{/if}
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
{/snippet}
