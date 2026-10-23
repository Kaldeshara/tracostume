<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const c = $derived(data.container);
</script>

<svelte:head><title>{m.nav_container()}</title></svelte:head>

<h1 class="mb-4">{m.nav_container()}</h1>
<form
	method="POST"
	use:enhance={() =>
		async ({ update }) =>
			update({ reset: false })}
	class="card flex max-w-xl flex-col gap-4 p-4"
>
	<div>
		<label class="label" for="name">{m.field_name()}</label>
		<input class="input" id="name" name="name" required value={c.name} />
	</div>
	<div>
		<label class="label" for="description">{m.field_description()}</label>
		<input class="input" id="description" name="description" value={c.description ?? ''} />
	</div>
	<p class="text-sm text-stone-500">{m.container_dimensions_hint()}</p>
	<div class="grid grid-cols-3 gap-2">
		<div>
			<label class="label" for="widthCm">{m.field_width()}</label>
			<input
				class="input"
				id="widthCm"
				name="widthCm"
				type="number"
				min="0"
				value={c.widthCm ?? ''}
			/>
		</div>
		<div>
			<label class="label" for="depthCm">{m.field_depth()}</label>
			<input
				class="input"
				id="depthCm"
				name="depthCm"
				type="number"
				min="0"
				value={c.depthCm ?? ''}
			/>
		</div>
		<div>
			<label class="label" for="heightCm">{m.field_height()}</label>
			<input
				class="input"
				id="heightCm"
				name="heightCm"
				type="number"
				min="0"
				value={c.heightCm ?? ''}
			/>
		</div>
	</div>
	{#if form?.saved}<p class="text-sm text-emerald-700">{m.saved()}</p>{/if}
	{#if form?.invalid}<p class="text-sm text-red-700">{m.form_invalid()}</p>{/if}
	<button class="btn btn-primary self-start">{m.action_save()}</button>
</form>
