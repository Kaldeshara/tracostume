<script lang="ts" module>
	export type NavIconName =
		| 'home'
		| 'gallery'
		| 'scan'
		| 'loans'
		| 'boxes'
		| 'map'
		| 'labels'
		| 'users'
		| 'container'
		| 'account'
		| 'close'
		| 'add'
		| 'logout'
		| 'sidebar'
		| 'lists';
</script>

<script lang="ts">
	let { name, class: className = 'h-5 w-5' }: { name: NavIconName; class?: string } = $props();
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
	{#if name === 'home'}
		<path d="M3 10.5 12 3l9 7.5" />
		<path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
	{:else if name === 'gallery'}
		<!-- Clothes hanger -->
		<path d="M12 8a2 2 0 1 1 2-2c0 1.1-.9 1.6-1.4 2-.4.3-.6.6-.6 1v1" />
		<path d="M12 10 3.3 16.2c-.8.6-.4 1.8.6 1.8h16.2c1 0 1.4-1.2.6-1.8L12 10" />
	{:else if name === 'scan'}
		<path
			d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"
		/>
		<rect x="7" y="7" width="4" height="4" rx="0.5" />
		<rect x="13" y="13" width="4" height="4" rx="0.5" />
		<path d="M13 7h4v2M7 15v2h2" />
	{:else if name === 'loans'}
		<path d="M8 3 4 7l4 4" />
		<path d="M4 7h16" />
		<path d="m16 21 4-4-4-4" />
		<path d="M20 17H4" />
	{:else if name === 'boxes'}
		<path d="M21 8v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8" />
		<rect x="2" y="3" width="20" height="5" rx="1" />
		<path d="M10 12h4" />
	{:else if name === 'map'}
		<path d="m21 16-9 5-9-5V8l9-5 9 5Z" />
		<path d="m3 8 9 5 9-5M12 13v8" />
	{:else if name === 'labels'}
		<rect x="3" y="3" width="7" height="7" rx="1" />
		<rect x="14" y="3" width="7" height="7" rx="1" />
		<rect x="3" y="14" width="7" height="7" rx="1" />
		<path d="M14 14h3v3h-3zM20 14v.01M20 20h-3M14 20v.01" />
	{:else if name === 'users'}
		<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
		<circle cx="9" cy="7" r="4" />
		<path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
	{:else if name === 'container'}
		<rect x="2" y="6" width="20" height="13" rx="1" />
		<path d="M6 9v7M10 9v7M14 9v7M18 9v7" />
	{:else if name === 'account'}
		<circle cx="12" cy="8" r="4" />
		<path d="M4 21a8 8 0 0 1 16 0" />
	{:else if name === 'close'}
		<path d="M6 6l12 12M18 6 6 18" />
	{:else if name === 'add'}
		<path d="M12 5v14M5 12h14" />
	{:else if name === 'logout'}
		<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
		<path d="m16 17 5-5-5-5M21 12H9" />
	{:else if name === 'lists'}
		<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
	{:else if name === 'sidebar'}
		<rect x="3" y="4" width="18" height="16" rx="2" />
		<path d="M9 4v16M16 10l-2 2 2 2" />
	{/if}
</svg>
