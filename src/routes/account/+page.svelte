<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import { roleLabel } from '#lib/format.ts';
	import LanguageSwitcher from '#lib/components/LanguageSwitcher.svelte';
	import PushToggle from '#lib/components/PushToggle.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{m.nav_account()}</title></svelte:head>

<h1 class="mb-1">{m.nav_account()}</h1>
<p class="mb-4 text-sm text-stone-600">
	{data.profile.email} · {data.user ? roleLabel(data.user.role) : ''}
</p>

<div class="grid max-w-3xl gap-6 md:grid-cols-2">
	<form
		method="POST"
		action="?/profile"
		use:enhance={() =>
			async ({ update }) =>
				update({ reset: false })}
		class="card flex flex-col gap-3 p-4"
	>
		<h2>{m.account_profile()}</h2>
		<div>
			<label class="label" for="firstName">{m.field_first_name()}</label>
			<input
				class="input"
				id="firstName"
				name="firstName"
				required
				value={data.profile.firstName}
			/>
		</div>
		<div>
			<label class="label" for="lastName">{m.field_last_name()}</label>
			<input class="input" id="lastName" name="lastName" required value={data.profile.lastName} />
		</div>
		<div>
			<label class="label" for="phone">{m.field_phone()}</label>
			<input class="input" id="phone" name="phone" type="tel" value={data.profile.phone ?? ''} />
		</div>
		<div>
			<span class="label">{m.account_language()}</span>
			<LanguageSwitcher />
		</div>
		{#if form?.profileSaved}<p class="text-sm text-emerald-700">{m.saved()}</p>{/if}
		{#if form?.profileInvalid}<p class="text-sm text-red-700">{m.form_invalid()}</p>{/if}
		<button class="btn btn-primary self-start">{m.action_save()}</button>
	</form>

	<form method="POST" action="?/password" use:enhance class="card flex flex-col gap-3 p-4">
		<h2>{m.account_password()}</h2>
		<div>
			<label class="label" for="current">{m.account_current_password()}</label>
			<input
				class="input"
				id="current"
				name="current"
				type="password"
				autocomplete="current-password"
				required
			/>
		</div>
		<div>
			<label class="label" for="next">{m.account_new_password()}</label>
			<input
				class="input"
				id="next"
				name="next"
				type="password"
				autocomplete="new-password"
				minlength="8"
				required
			/>
		</div>
		{#if form?.passwordSaved}<p class="text-sm text-emerald-700">{m.saved()}</p>{/if}
		{#if form?.passwordError === 'wrong'}<p class="text-sm text-red-700">
				{m.account_password_wrong()}
			</p>{/if}
		{#if form?.passwordError === 'short'}<p class="text-sm text-red-700">
				{m.register_password_hint()}
			</p>{/if}
		<button class="btn btn-primary self-start">{m.action_save()}</button>
	</form>
	<PushToggle />
</div>
