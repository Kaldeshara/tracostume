<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { applyThemePreference, type ThemePreference } from '#lib/theme.ts';

	// Compact System / Light / Dark switch (icons), as in Tracster.
	let { preference: initialPreference }: { preference: ThemePreference } = $props();

	let chosen: ThemePreference | undefined = $state();
	const preference = $derived(chosen ?? initialPreference);

	const options: { value: ThemePreference; label: () => string }[] = [
		{ value: 'system', label: m.theme_system },
		{ value: 'light', label: m.theme_light },
		{ value: 'dark', label: m.theme_dark }
	];

	function choose(next: ThemePreference) {
		chosen = next;
		applyThemePreference(next);
	}
</script>

<div
	role="group"
	aria-label={m.theme_title()}
	class="inline-flex rounded-full border border-stone-300 p-0.5"
>
	{#each options as option (option.value)}
		<button
			type="button"
			onclick={() => choose(option.value)}
			aria-pressed={preference === option.value}
			aria-label={option.label()}
			title={option.label()}
			class="inline-flex h-9 w-9 items-center justify-center rounded-full transition pointer-coarse:h-11 pointer-coarse:w-11 {preference ===
			option.value
				? 'bg-stone-900 text-white'
				: 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'}"
		>
			<svg
				viewBox="0 0 24 24"
				class="h-4 w-4"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				{#if option.value === 'system'}
					<rect x="3" y="4" width="18" height="12" rx="2" />
					<path d="M8 20h8M12 16v4" />
				{:else if option.value === 'light'}
					<circle cx="12" cy="12" r="4" />
					<path
						d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
					/>
				{:else}
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
				{/if}
			</svg>
		</button>
	{/each}
</div>
