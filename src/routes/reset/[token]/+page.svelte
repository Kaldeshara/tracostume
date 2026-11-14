<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{m.reset_title()}</title></svelte:head>

<div class="mx-auto mt-10 max-w-sm">
	<form method="POST" use:enhance class="card flex flex-col gap-4 p-6">
		<h1>{m.reset_title()}</h1>
		<p class="text-sm text-stone-600">{m.reset_help({ name: data.firstName })}</p>
		<div>
			<label class="label" for="password">{m.account_new_password()}</label>
			<input
				class="input"
				id="password"
				name="password"
				type="password"
				autocomplete="new-password"
				minlength="8"
				required
			/>
		</div>
		<div>
			<label class="label" for="confirm">{m.reset_confirm()}</label>
			<input
				class="input"
				id="confirm"
				name="confirm"
				type="password"
				autocomplete="new-password"
				minlength="8"
				required
			/>
		</div>
		{#if form?.short}<p class="text-sm text-red-700">{m.reset_too_short()}</p>{/if}
		{#if form?.mismatch}<p class="text-sm text-red-700">{m.reset_mismatch()}</p>{/if}
		<button class="btn btn-primary">{m.reset_submit()}</button>
	</form>
</div>
