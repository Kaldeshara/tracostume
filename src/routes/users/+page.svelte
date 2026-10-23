<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import { roleLabel } from '#lib/format.ts';
	import { hasRole, ROLES } from '#lib/roles.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const isOwner = $derived(hasRole(data.user?.role, 'OWNER'));
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
		</li>
	{/each}
</ul>
