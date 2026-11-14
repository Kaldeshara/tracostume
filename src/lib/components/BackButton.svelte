<script lang="ts">
	import { goto } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { cameFromApp } from '#lib/back.svelte.ts';

	// Tracster's back button, on phones too: an installed app has no browser back button.
	// Goes to the previous app page, or to the parent page when opened from a link.
	let { parent }: { parent: string } = $props();

	function back() {
		if (cameFromApp.value) history.back();
		else goto(parent);
	}
</script>

<button
	type="button"
	onclick={back}
	aria-label={m.nav_back()}
	title={m.nav_back()}
	class="no-print inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-100 hover:text-stone-900"
>
	<svg
		viewBox="0 0 24 24"
		class="h-5 w-5"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M19 12H5M11 6l-6 6 6 6" />
	</svg>
</button>
