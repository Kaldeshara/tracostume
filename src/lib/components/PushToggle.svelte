<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';

	// Loan reminders on this phone (Web Push). On iPhone this only works once the app is
	// installed on the home screen.

	let status = $state<'loading' | 'unsupported' | 'denied' | 'off' | 'on'>('loading');
	let busy = $state(false);
	let testResult = $state<string | null>(null);

	const supported = () =>
		'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

	async function currentSubscription() {
		const registration = await navigator.serviceWorker.ready;
		return registration.pushManager.getSubscription();
	}

	onMount(async () => {
		if (!supported()) {
			status = 'unsupported';
			return;
		}
		if (Notification.permission === 'denied') {
			status = 'denied';
			return;
		}
		status = (await currentSubscription()) ? 'on' : 'off';
	});

	async function enable() {
		busy = true;
		testResult = null;
		try {
			if ((await Notification.requestPermission()) !== 'granted') {
				status = 'denied';
				return;
			}
			const { publicKey } = await (await fetch('/push')).json();
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: Uint8Array.from(
					atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')),
					(char) => char.charCodeAt(0)
				)
			});
			const response = await fetch('/push', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ...subscription.toJSON(), locale: getLocale() })
			});
			status = response.ok ? 'on' : 'off';
		} catch (err) {
			console.error(err);
			status = 'off';
		} finally {
			busy = false;
		}
	}

	async function disable() {
		busy = true;
		testResult = null;
		try {
			const subscription = await currentSubscription();
			if (subscription) {
				await fetch('/push', {
					method: 'DELETE',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ endpoint: subscription.endpoint })
				});
				await subscription.unsubscribe();
			}
			status = 'off';
		} finally {
			busy = false;
		}
	}

	async function test() {
		busy = true;
		try {
			const { sent } = await (await fetch('/push/test', { method: 'POST' })).json();
			testResult = sent ? m.push_test_sent() : m.push_test_failed();
		} catch {
			testResult = m.push_test_failed();
		} finally {
			busy = false;
		}
	}
</script>

<div class="card flex flex-col gap-3 p-4">
	<h2>{m.push_title()}</h2>
	<p class="text-sm text-stone-600">{m.push_help()}</p>
	{#if status === 'unsupported'}
		<p class="text-sm text-amber-800">{m.push_unsupported()}</p>
	{:else if status === 'denied'}
		<p class="text-sm text-amber-800">{m.push_denied()}</p>
	{:else if status === 'on'}
		<p class="text-sm text-emerald-700">{m.push_on()}</p>
		<div class="flex flex-wrap gap-2">
			<button type="button" class="btn" disabled={busy} onclick={test}>{m.push_test()}</button>
			<button type="button" class="btn btn-danger" disabled={busy} onclick={disable}>
				{m.push_disable()}
			</button>
		</div>
		{#if testResult}<p class="text-sm text-stone-600">{testResult}</p>{/if}
	{:else if status === 'off'}
		<button type="button" class="btn btn-primary self-start" disabled={busy} onclick={enable}>
			{m.push_enable()}
		</button>
	{/if}
</div>
