<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import ItemForm from '#lib/components/ItemForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{m.item_edit()}</title></svelte:head>

<h1 class="mb-4">{m.item_edit()} <span class="font-mono text-stone-500">{data.item.code}</span></h1>
<ItemForm
	values={form?.values ?? data.values}
	options={data.options}
	isNew={false}
	invalid={form?.invalid}
	submitLabel={m.action_save()}
/>
