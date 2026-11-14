<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';

	// Filters in a modal: a bottom sheet on phones, a centered dialog on larger screens.
	// Changes apply immediately; close by tapping outside, swiping the sheet down, Escape, or "Done".

	const SWIPE_DOWN_CLOSE_DISTANCE_PX = 80;

	let {
		open = $bindable(false),
		title,
		summary,
		doneLabel,
		children
	}: {
		open?: boolean;
		title: string;
		summary?: string;
		doneLabel?: string;
		children: Snippet;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let swipeStartY: number | null = null;

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
		if (!open) return;
		// A modal <dialog> does not stop the page behind it from scrolling.
		document.documentElement.style.overflow = 'hidden';
		return () => {
			document.documentElement.style.overflow = '';
		};
	});

	function closeOnSwipeDown(event: TouchEvent) {
		const startY = swipeStartY;
		swipeStartY = null;
		if (startY !== null && event.changedTouches[0].clientY - startY >= SWIPE_DOWN_CLOSE_DISTANCE_PX)
			open = false;
	}
</script>

<!-- Clicks on the ::backdrop target the <dialog> element itself. -->
<dialog
	bind:this={dialog}
	aria-label={title}
	onclose={() => (open = false)}
	onclick={(event) => {
		if (event.target === event.currentTarget) open = false;
	}}
	class="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-2xl bg-white p-0 text-stone-900 shadow-xl transition-[translate,opacity,overlay,display] transition-discrete duration-(--duration-medium) ease-stage outline-none not-open:translate-y-6 not-open:opacity-0 not-open:duration-(--duration-short) backdrop:bg-black/50 backdrop:transition-[opacity,overlay,display] backdrop:transition-discrete backdrop:duration-(--duration-medium) not-open:backdrop:opacity-0 motion-reduce:transition-none motion-reduce:backdrop:transition-none md:m-auto md:max-w-lg md:rounded-2xl starting:translate-y-6 starting:opacity-0 starting:backdrop:opacity-0"
>
	<div class="flex max-h-[85dvh] flex-col pb-[env(safe-area-inset-bottom)]">
		<!-- The swipe-down gesture is a touch shortcut for the "Done" button. -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="shrink-0 px-5 pt-2 pb-3"
			ontouchstart={(event) => (swipeStartY = event.touches[0].clientY)}
			ontouchend={closeOnSwipeDown}
		>
			<div
				aria-hidden="true"
				class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-300 md:hidden"
			></div>
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<h2 class="text-lg font-semibold tracking-tight">{title}</h2>
					{#if summary}<p class="mt-0.5 text-sm text-stone-500">{summary}</p>{/if}
				</div>
				<button type="button" class="btn btn-primary shrink-0" onclick={() => (open = false)}>
					{doneLabel ?? m.filter_done()}
				</button>
			</div>
		</div>
		<div class="overflow-y-auto overscroll-contain border-t border-stone-100 px-5 pt-4 pb-6">
			{@render children()}
		</div>
	</div>
</dialog>
