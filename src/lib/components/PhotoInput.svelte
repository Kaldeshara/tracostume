<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// File input that shrinks photos in the browser before upload: phone photos are often
	// 5 MB or more, which is slow on mobile data and wasteful to store.

	let { name = 'photos', multiple = true }: { name?: string; multiple?: boolean } = $props();

	const MAX_SIDE = 1600;
	const QUALITY = 0.85;

	let previews = $state<string[]>([]);
	let busy = $state(false);

	async function resize(file: File): Promise<File> {
		if (!file.type.startsWith('image/')) return file;
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(bitmap.width * scale);
		canvas.height = Math.round(bitmap.height * scale);
		canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		bitmap.close();
		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, 'image/jpeg', QUALITY)
		);
		if (!blob) return file;
		return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
	}

	async function onchange(event: Event & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		const files = [...(input.files ?? [])];
		previews.forEach((url) => URL.revokeObjectURL(url));
		previews = [];
		if (!files.length) return;

		busy = true;
		try {
			const resized = await Promise.all(files.map(resize));
			const transfer = new DataTransfer();
			resized.forEach((file) => transfer.items.add(file));
			input.files = transfer.files;
			previews = resized.map((file) => URL.createObjectURL(file));
		} catch {
			// Keep the original files if the browser cannot decode them (e.g. HEIC on desktop).
			previews = files.map((file) => URL.createObjectURL(file));
		} finally {
			busy = false;
		}
	}
</script>

<div>
	<input
		type="file"
		{name}
		accept="image/*"
		{multiple}
		{onchange}
		class="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-2 file:font-medium file:text-brand-800"
	/>
	{#if busy}<p class="mt-2 text-sm text-stone-500">{m.photo_preparing()}</p>{/if}
	{#if previews.length}
		<div class="mt-2 flex flex-wrap gap-2">
			{#each previews as src (src)}
				<img {src} alt="" class="h-20 w-20 rounded-lg object-cover" />
			{/each}
		</div>
	{/if}
</div>
