<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	let { values = {} }: { values?: Record<string, string | number | null> } = $props();

	const value = (key: string) => values[key] ?? '';
</script>

<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
	<div>
		<label class="label" for="label">{m.field_label()} *</label>
		<input class="input" id="label" name="label" required value={value('label')} />
	</div>
	<div>
		<label class="label" for="shelf">{m.field_shelf()}</label>
		<input
			class="input"
			id="shelf"
			name="shelf"
			value={value('shelf')}
			placeholder={m.field_shelf_placeholder()}
		/>
	</div>
</div>
<div>
	<label class="label" for="description">{m.field_description()}</label>
	<input class="input" id="description" name="description" value={value('description')} />
</div>
<details class="text-sm">
	<summary class="cursor-pointer text-stone-600">{m.box_dimensions()}</summary>
	<p class="my-2 text-xs text-stone-500">{m.box_dimensions_hint()}</p>
	<div class="grid grid-cols-3 gap-2">
		{#each [['widthCm', m.field_width], ['depthCm', m.field_depth], ['heightCm', m.field_height], ['posXCm', m.field_pos_x], ['posYCm', m.field_pos_y], ['posZCm', m.field_pos_z]] as const as [key, label] (key)}
			<div>
				<label class="label text-xs" for={key}>{label()}</label>
				<input
					class="input"
					id={key}
					name={key}
					type="number"
					min="0"
					inputmode="numeric"
					value={value(key)}
				/>
			</div>
		{/each}
	</div>
</details>
