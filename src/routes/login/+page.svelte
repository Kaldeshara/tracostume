<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { PUBLIC_APP_NAME } from '$app/env/public';
	import { m } from '#lib/paraglide/messages.js';
	import LanguageSwitcher from '#lib/components/LanguageSwitcher.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<div class="mx-auto mt-10 max-w-sm">
	<div class="mb-6 flex flex-col items-center gap-3">
		<img src="/icon.svg" alt="" class="h-16 w-16" />
		<h1>{PUBLIC_APP_NAME}</h1>
	</div>

	<form method="POST" use:enhance class="card flex flex-col gap-4 p-6">
		<h2>{m.login_title()}</h2>
		<div>
			<label class="label" for="email">{m.field_email()}</label>
			<input
				class="input"
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				required
				value={form?.email ?? ''}
			/>
		</div>
		<div>
			<label class="label" for="password">{m.field_password()}</label>
			<input
				class="input"
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
			/>
		</div>
		{#if form?.invalid}<p class="text-sm text-red-700">{m.login_invalid()}</p>{/if}
		<button class="btn btn-primary">{m.login_submit()}</button>
		<p class="text-center text-sm text-stone-600">
			{data.hasUsers ? m.login_no_account() : m.login_first_account()}
			<a class="link" href="/register{page.url.search}">{m.register_link()}</a>
		</p>
	</form>

	<div class="mt-6 flex justify-center"><LanguageSwitcher /></div>
</div>
