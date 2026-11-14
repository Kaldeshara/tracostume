<script lang="ts">
	import type { BoxKind } from '../../generated/prisma/enums';

	// Storage unit kinds as line icons (same family as NavIcon), instead of emoji.
	let { kind, class: className = 'h-5 w-5' }: { kind: BoxKind; class?: string } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	class={className}
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if kind === 'PLASTIC_BOX'}
		<rect x="3" y="7" width="18" height="13" rx="2" />
		<path d="M2 7h20M9 11h6" />
	{:else if kind === 'CARDBOARD_BOX'}
		<path d="m21 8-9-5-9 5v8l9 5 9-5Z" />
		<path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5" />
	{:else if kind === 'CANVAS_BAG'}
		<path d="M5 8h14l-1 12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1Z" />
		<path d="M9 8V6a3 3 0 0 1 6 0v2" />
	{:else if kind === 'RACK'}
		<path d="M3 4h18M5 4v17M19 4v17M3 21h4M17 21h4" />
		<path d="M10 4v3l-2.5 6h5L10 7M15 4v3l-2 5h4l-2-5" />
	{:else}
		<rect x="4" y="4" width="16" height="16" rx="2" />
	{/if}
</svg>
