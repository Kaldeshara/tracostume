<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import ItemForm from '#lib/components/ItemForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const empty = {
		name: '',
		description: '',
		category: '',
		color: '',
		size: '',
		condition: 'GOOD',
		tags: '',
		boxId: ''
	};
</script>

<svelte:head><title>{m.item_new()}</title></svelte:head>

<h1 class="mb-4">{m.item_new()}</h1>
<ItemForm
	values={form?.values ?? { ...empty, boxId: data.boxId }}
	options={data.options}
	isNew
	invalid={form?.invalid}
	submitLabel={m.action_create()}
/>
