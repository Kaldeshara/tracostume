<script lang="ts">
	// Christmas strip under the header (two strings of twinkling bulbs and falling snow),
	// ported from Tracster; the styles come from dance-ui.
	const BULB_COLORS = ['#ef4444', '#22c55e', '#facc15', '#38bdf8', '#fb923c', '#e879f9', '#fef08a'];

	const ROWS = [
		{
			count: 18,
			wireClass: 'top-[38%]',
			dangle: '0px',
			path: 'M0 6 Q 20 1, 40 5 T 80 4 Q 90 7, 100 5'
		},
		{ count: 16, wireClass: 'top-[72%]', dangle: '3px', path: 'M0 4 Q 30 8, 50 4 T 100 6' }
	];

	const SNOWFLAKES = [
		{ left: '6%', delay: '0s', duration: '4.2s', size: '4px' },
		{ left: '18%', delay: '1.1s', duration: '5.5s', size: '3px' },
		{ left: '31%', delay: '0.4s', duration: '4.8s', size: '5px' },
		{ left: '47%', delay: '2s', duration: '5.2s', size: '3px' },
		{ left: '62%', delay: '0.8s', duration: '4.5s', size: '4px' },
		{ left: '78%', delay: '1.6s', duration: '5.8s', size: '3px' },
		{ left: '91%', delay: '0.2s', duration: '4.9s', size: '5px' }
	];

	const bulbStyle = (index: number, row: number) =>
		[
			`color: ${BULB_COLORS[(index + row * 3) % BULB_COLORS.length]}`,
			row === 1 ? `margin-top: ${ROWS[1].dangle}` : '',
			`animation-duration: ${1.6 + (index % 5) * 0.35}s`,
			`animation-delay: ${((index * 0.19 + row * 0.4) % 2.6).toFixed(2)}s`
		]
			.filter(Boolean)
			.join('; ');
</script>

<div class="relative h-11 w-full overflow-hidden border-b border-red-950/30" aria-hidden="true">
	<div class="festive-strip-sky absolute inset-0"></div>
	<div class="festive-strip-stars absolute inset-0 opacity-80"></div>

	{#each ROWS as row (row.path)}
		<svg
			class="pointer-events-none absolute inset-x-0 {row.wireClass} h-3 w-full -translate-y-1/2 text-emerald-600/90"
			viewBox="0 0 100 10"
			preserveAspectRatio="none"
		>
			<path
				d={row.path}
				fill="none"
				stroke="currentColor"
				stroke-width="1"
				vector-effect="non-scaling-stroke"
			/>
		</svg>
	{/each}

	<div class="relative z-[1] flex h-full flex-col justify-between py-1">
		{#each ROWS as row, rowIndex (row.path)}
			<ul class="flex list-none items-end justify-between px-0.5 sm:px-2">
				{#each { length: row.count }, index (index)}
					<li class="flex flex-1 justify-center">
						<span
							class="christmas-bulb classic-bulb flex flex-col items-center"
							style={bulbStyle(index, rowIndex)}
						>
							<span class="classic-bulb-cap"></span>
							<span
								class="classic-bulb-glass"
								style="background-color: {BULB_COLORS[(index + rowIndex * 3) % BULB_COLORS.length]}"
							></span>
						</span>
					</li>
				{/each}
			</ul>
		{/each}
	</div>

	{#each SNOWFLAKES as flake (flake.left)}
		<span
			class="festive-snowflake pointer-events-none absolute top-0 rounded-full bg-white/90"
			style="left: {flake.left}; width: {flake.size}; height: {flake.size}; animation-delay: {flake.delay}; animation-duration: {flake.duration}"
		></span>
	{/each}
</div>
