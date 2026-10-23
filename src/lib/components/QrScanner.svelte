<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		/** Called for each QR code read. The same value is ignored for a short while. */
		onscan: (value: string) => void;
	};

	let { onscan }: Props = $props();

	let video: HTMLVideoElement;
	let status = $state<'starting' | 'running' | 'denied' | 'unsupported'>('starting');

	const REPEAT_DELAY_MS = 2500;

	// Native BarcodeDetector on Android/Chrome; the zxing WebAssembly ponyfill elsewhere (iOS).
	async function createDetector() {
		const Native = (
			globalThis as { BarcodeDetector?: typeof import('barcode-detector').BarcodeDetector }
		).BarcodeDetector;
		if (Native && (await Native.getSupportedFormats()).includes('qr_code')) {
			return new Native({ formats: ['qr_code'] });
		}
		const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
			import('barcode-detector/ponyfill'),
			import('zxing-wasm/reader/zxing_reader.wasm?url')
		]);
		prepareZXingModule({
			overrides: {
				locateFile: (path: string, prefix: string) =>
					path.endsWith('.wasm') ? wasmUrl : prefix + path
			}
		});
		return new BarcodeDetector({ formats: ['qr_code'] });
	}

	onMount(() => {
		let stream: MediaStream | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let stopped = false;
		let lastValue = '';
		let lastTime = 0;

		(async () => {
			if (!navigator.mediaDevices?.getUserMedia) {
				status = 'unsupported';
				return;
			}
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: 'environment' },
					audio: false
				});
			} catch {
				status = 'denied';
				return;
			}
			if (stopped) return stream.getTracks().forEach((track) => track.stop());

			video.srcObject = stream;
			await video.play();
			const detector = await createDetector();
			status = 'running';

			const tick = async () => {
				if (stopped) return;
				try {
					if (video.readyState >= 2) {
						for (const code of await detector.detect(video)) {
							const now = Date.now();
							if (code.rawValue === lastValue && now - lastTime < REPEAT_DELAY_MS) continue;
							lastValue = code.rawValue;
							lastTime = now;
							navigator.vibrate?.(60);
							onscan(code.rawValue);
						}
					}
				} catch {
					// A failed frame is not fatal; try the next one.
				}
				timer = setTimeout(tick, 200);
			};
			tick();
		})();

		return () => {
			stopped = true;
			clearTimeout(timer);
			stream?.getTracks().forEach((track) => track.stop());
		};
	});
</script>

<div class="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
	<video bind:this={video} playsinline muted class="h-full w-full object-cover"></video>
	{#if status === 'running'}
		<div
			class="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
		></div>
	{:else}
		<div
			class="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white"
		>
			{#if status === 'starting'}{m.scan_starting()}
			{:else if status === 'denied'}{m.scan_denied()}
			{:else}{m.scan_unsupported()}{/if}
		</div>
	{/if}
</div>
