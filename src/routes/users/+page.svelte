<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import { roleLabel } from '#lib/format.ts';
	import { hasRole, ROLES } from '#lib/roles.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const isOwner = $derived(hasRole(data.user?.role, 'OWNER'));
	let copied = $state(false);

	function smsLink(phone: string, url: string) {
		return `sms:${phone.replace(/\s+/g, '')}?&body=${encodeURIComponent(m.users_reset_sms({ url }))}`;
	}

	async function copy(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
		} catch {
			copied = false;
		}
	}
</script>

<svelte:head><title>{m.nav_users()}</title></svelte:head>

<h1 class="mb-2">{m.nav_users()}</h1>
<p class="mb-4 text-sm text-stone-600">{m.users_roles_help()}</p>

<ul class="card divide-y divide-stone-100">
	{#each data.users as user (user.id)}
		<li class="flex flex-wrap items-center gap-3 px-4 py-3">
			<div class="min-w-0 flex-1">
				<div class="font-medium">{user.firstName} {user.lastName}</div>
				<div class="text-xs text-stone-500">
					{user.email}{user.phone ? ` · ${user.phone}` : ''}
					{#if user._count.borrowedLoans}· {m.users_borrowed({
							count: user._count.borrowedLoans
						})}{/if}
				</div>
			</div>
			{#if user.id === data.user?.id || (user.role === 'OWNER' && !isOwner)}
				<span class="chip bg-stone-100 text-stone-700">{roleLabel(user.role)}</span>
			{:else}
				<form
					method="POST"
					action="?/resetLink"
					use:enhance={() => {
						copied = false;
						return ({ update }) => update({ reset: false });
					}}
				>
					<input type="hidden" name="userId" value={user.id} />
					<button class="btn py-1">{m.users_reset_link()}</button>
				</form>
				<form method="POST" action="?/setRole" use:enhance>
					<input type="hidden" name="userId" value={user.id} />
					<select
						class="input w-auto py-1"
						name="role"
						value={user.role}
						onchange={(event) => event.currentTarget.form?.requestSubmit()}
					>
						{#each ROLES.filter((role) => role !== 'OWNER' || isOwner) as role (role)}
							<option value={role}>{roleLabel(role)}</option>
						{/each}
					</select>
				</form>
			{/if}
			{#if form?.reset?.userId === user.id}
				<div class="w-full rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
					<p class="mb-2">{m.users_reset_help()}</p>
					<input class="input mb-2 font-mono text-xs" readonly value={form.reset.url} />
					<div class="flex flex-wrap gap-2">
						<button type="button" class="btn" onclick={() => copy(form.reset!.url)}>
							{copied ? m.users_reset_copied() : m.users_reset_copy()}
						</button>
						{#if user.phone}
							<a class="btn" href={smsLink(user.phone, form.reset.url)}
								>{m.users_reset_send_sms()}</a
							>
						{/if}
					</div>
				</div>
			{/if}
		</li>
	{/each}
</ul>
