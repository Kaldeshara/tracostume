<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const errors = {
		registeringPassword: m.register_error_password,
		invalid: m.register_error_invalid,
		emailTaken: m.register_error_email_taken
	};
</script>

<div class="mx-auto mt-10 max-w-sm">
	<form method="POST" use:enhance class="card flex flex-col gap-4 p-6">
		<h1>{m.register_title()}</h1>
		{#if data.passwordRequired}
			<div>
				<label class="label" for="registeringPassword">{m.register_troupe_password()}</label>
				<input
					class="input"
					id="registeringPassword"
					name="registeringPassword"
					type="password"
					required
				/>
			</div>
		{/if}
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="label" for="firstName">{m.field_first_name()}</label>
				<input
					class="input"
					id="firstName"
					name="firstName"
					autocomplete="given-name"
					required
					value={form?.values.firstName ?? ''}
				/>
			</div>
			<div>
				<label class="label" for="lastName">{m.field_last_name()}</label>
				<input
					class="input"
					id="lastName"
					name="lastName"
					autocomplete="family-name"
					required
					value={form?.values.lastName ?? ''}
				/>
			</div>
		</div>
		<div>
			<label class="label" for="email">{m.field_email()}</label>
			<input
				class="input"
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				required
				value={form?.values.email ?? ''}
			/>
		</div>
		<div>
			<label class="label" for="phone">{m.field_phone()}</label>
			<input
				class="input"
				id="phone"
				name="phone"
				type="tel"
				autocomplete="tel"
				value={form?.values.phone ?? ''}
			/>
		</div>
		<div>
			<label class="label" for="password">{m.field_password()}</label>
			<input
				class="input"
				id="password"
				name="password"
				type="password"
				autocomplete="new-password"
				minlength="8"
				required
			/>
			<p class="mt-1 text-xs text-stone-500">{m.register_password_hint()}</p>
		</div>
		{#if form?.error}<p class="text-sm text-red-700">{errors[form.error]()}</p>{/if}
		<button class="btn btn-primary">{m.register_submit()}</button>
		<p class="text-center text-sm">
			<a class="link" href="/login{page.url.search}">{m.register_back_to_login()}</a>
		</p>
	</form>
</div>
