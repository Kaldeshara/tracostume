<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import { CONDITIONS, conditionLabel } from '#lib/format.ts';
	import {
		CATEGORIES_BY_GROUP,
		CATEGORY_GROUPS,
		categoryGroupLabel,
		categoryLabel
	} from '#lib/categories.ts';
	import type { ItemFormValues } from '#lib/server/item-form.ts';
	import PhotoInput from './PhotoInput.svelte';

	type Props = {
		values: ItemFormValues;
		options: {
			boxes: { id: string; code: string; label: string }[];
			colors: string[];
			tags: string[];
		};
		isNew: boolean;
		invalid?: boolean;
		submitLabel: string;
	};

	let { values, options, isNew, invalid = false, submitLabel }: Props = $props();
	let submitting = $state(false);
</script>

<form
	method="POST"
	enctype="multipart/form-data"
	class="card flex flex-col gap-4 p-4 md:p-6"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update({ reset: false });
			submitting = false;
		};
	}}
>
	<div>
		<label class="label" for="name">{m.field_name()} *</label>
		<input class="input" id="name" name="name" required value={values.name} />
	</div>

	<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
		<div>
			<label class="label" for="category">{m.field_category()}</label>
			<select class="input" id="category" name="category" value={values.category || 'UNSORTED'}>
				{#each CATEGORY_GROUPS as group (group)}
					<optgroup label={categoryGroupLabel(group)}>
						{#each CATEGORIES_BY_GROUP[group] as category (category)}
							<option value={category}>{categoryLabel(category)}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</div>
		<div>
			<label class="label" for="color">{m.field_color()}</label>
			<input class="input" id="color" name="color" list="colors" value={values.color} />
			<datalist id="colors">
				{#each options.colors as value (value)}<option {value}></option>{/each}
			</datalist>
		</div>
		<div>
			<label class="label" for="size">{m.field_size()}</label>
			<input class="input" id="size" name="size" value={values.size} />
			{#if isNew}<p class="mt-1 text-xs text-stone-500">{m.item_sizes_hint()}</p>{/if}
		</div>
	</div>

	{#if isNew}
		<div class="md:w-1/3">
			<label class="label" for="quantity">{m.field_quantity()}</label>
			<input
				class="input"
				id="quantity"
				name="quantity"
				type="number"
				min="1"
				max="100"
				value="1"
			/>
			<p class="mt-1 text-xs text-stone-500">{m.item_quantity_hint()}</p>
		</div>
	{/if}

	<div>
		<label class="label" for="description">{m.field_description()}</label>
		<textarea class="input" id="description" name="description" rows="3"
			>{values.description}</textarea
		>
	</div>

	<div>
		<label class="label" for="tags">{m.field_tags()}</label>
		<input
			class="input"
			id="tags"
			name="tags"
			value={values.tags}
			placeholder={options.tags.slice(0, 4).join(', ')}
		/>
		<p class="mt-1 text-xs text-stone-500">{m.item_tags_hint()}</p>
	</div>

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<div>
			<label class="label" for="condition">{m.field_condition()}</label>
			<select class="input" id="condition" name="condition" value={values.condition}>
				{#each CONDITIONS as condition (condition)}
					<option value={condition}>{conditionLabel(condition)}</option>
				{/each}
			</select>
		</div>
		{#if isNew}
			<div>
				<label class="label" for="boxId">{m.field_box()}</label>
				<select class="input" id="boxId" name="boxId" value={values.boxId}>
					<option value="">{m.item_no_box()}</option>
					{#each options.boxes as box (box.id)}
						<option value={box.id}>{box.code} · {box.label}</option>
					{/each}
				</select>
			</div>
		{/if}
	</div>

	{#if isNew}
		<div>
			<span class="label">{m.field_photos()}</span>
			<PhotoInput />
		</div>
	{/if}

	{#if invalid}<p class="text-sm text-red-700">{m.form_invalid()}</p>{/if}

	<div class="flex gap-2">
		<button class="btn btn-primary" disabled={submitting}>{submitLabel}</button>
		<button type="button" class="btn" onclick={() => history.back()}>{m.action_cancel()}</button>
	</div>
</form>
