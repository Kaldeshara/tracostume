<script lang="ts">
	// Tracster's floating "+" (phones and tablets): the page's main create action, as a link or
	// a button. Pages keep a visible button for desktops, where the sidebar replaces the tab bar.
	let { label, href, onclick }: { label: string; href?: string; onclick?: () => void } = $props();

	const className =
		'no-print fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-stage text-[#fff] shadow-lg ring-2 ring-spotlight/60 transition active:scale-95 lg:hidden';
</script>

{#snippet plus()}
	<svg
		viewBox="0 0 24 24"
		class="h-6 w-6"
		fill="none"
		stroke="currentColor"
		stroke-width="2.25"
		stroke-linecap="round"
		aria-hidden="true"
	>
		<path d="M12 5v14M5 12h14" />
	</svg>
{/snippet}

{#if href}
	<a {href} data-fab aria-label={label} title={label} class={className}>{@render plus()}</a>
{:else}
	<button type="button" data-fab aria-label={label} title={label} class={className} {onclick}>
		{@render plus()}
	</button>
{/if}
