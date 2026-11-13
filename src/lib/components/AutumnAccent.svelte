<script lang="ts">
	// Autumn strip under the header (garland and falling leaves), ported from Tracster.
	const LEAF_COLORS = ['#c2410c', '#ca8a04', '#b45309', '#9a3412', '#d97706'];

	const GARLAND_LEAVES = [
		{ rotate: -18, scale: 1 },
		{ rotate: 12, scale: 0.85 },
		{ rotate: -8, scale: 1.1 },
		{ rotate: 22, scale: 0.9 },
		{ rotate: -14, scale: 1 },
		{ rotate: 8, scale: 0.95 },
		{ rotate: -20, scale: 1.05 },
		{ rotate: 16, scale: 0.88 },
		{ rotate: -6, scale: 1 }
	];

	const FALLING_LEAVES = [
		{ left: '8%', delay: '0s', duration: '5.2s', color: 0, drift: '-12px' },
		{ left: '22%', delay: '1.4s', duration: '6.1s', color: 1, drift: '10px' },
		{ left: '35%', delay: '0.6s', duration: '5.5s', color: 2, drift: '-8px' },
		{ left: '48%', delay: '2.1s', duration: '6.4s', color: 3, drift: '14px' },
		{ left: '61%', delay: '0.3s', duration: '5.8s', color: 4, drift: '-10px' },
		{ left: '74%', delay: '1.8s', duration: '6s', color: 0, drift: '8px' },
		{ left: '88%', delay: '1s', duration: '5.6s', color: 1, drift: '-14px' }
	];
</script>

{#snippet leaf(color: string, className: string, style: string)}
	<svg viewBox="0 0 20 24" class={className} style="color: {color}; {style}" aria-hidden="true">
		<path
			fill="currentColor"
			d="M10 1.5C7 5.5 3.5 7 2.5 11c-.8 3.2.5 6.5 3.8 8.2 1.8.9 3.5 1.1 3.7 1.1.2 0 1.9-.2 3.7-1.1 3.3-1.7 4.6-5 3.8-8.2-1-4-4.5-5.5-7.5-9.5-.3-.4-.8-.4-1 0Z"
		/>
		<path
			fill="none"
			stroke="currentColor"
			stroke-width="0.6"
			stroke-opacity="0.35"
			d="M10 3v18M10 8l-3 2M10 12l3 1.5M10 16l-2.5 2"
		/>
	</svg>
{/snippet}

<div class="relative h-10 w-full overflow-hidden border-b border-amber-900/30" aria-hidden="true">
	<div class="autumn-strip-sky absolute inset-0"></div>
	<ul
		class="pointer-events-none absolute inset-x-0 top-1.5 z-[1] flex list-none justify-between px-1 sm:px-3"
	>
		{#each GARLAND_LEAVES as garlandLeaf, index (index)}
			<li class="flex flex-1 justify-center">
				{@render leaf(
					LEAF_COLORS[index % LEAF_COLORS.length],
					'h-4 w-3.5 drop-shadow-sm sm:h-5 sm:w-4',
					`transform: rotate(${garlandLeaf.rotate}deg) scale(${garlandLeaf.scale})`
				)}
			</li>
		{/each}
	</ul>
	{#each FALLING_LEAVES as fallingLeaf, index (index)}
		{@render leaf(
			LEAF_COLORS[fallingLeaf.color],
			'autumn-leaf pointer-events-none absolute top-0 z-[2] h-3.5 w-3 opacity-90',
			`left: ${fallingLeaf.left}; animation-delay: ${fallingLeaf.delay}; animation-duration: ${fallingLeaf.duration}; --autumn-drift: ${fallingLeaf.drift}`
		)}
	{/each}
</div>
