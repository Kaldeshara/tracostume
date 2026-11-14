import { browser } from '$app/env';
import type { ItemCard } from '#lib/server/items.ts';
import { parseScannedCode } from './scan-code';

// Offline scanner: the container often has no signal. The scanner keeps a copy of every piece and
// box on the phone (to resolve scans) and queues the actions done offline, with the time they
// were done, until the connection is back. Browser-only state, like the selection.

export type ScanBox = {
	id: string;
	code: string;
	label: string;
	shelf: string | null;
	_count: { items: number };
};
export type ScanResult =
	| { type: 'item'; item: ItemCard }
	| { type: 'box'; box: ScanBox }
	| { type: 'unknown'; code: string };

type Catalogue = { items: ItemCard[]; boxes: ScanBox[]; savedAt: string };

export type QueuedAction = {
	id: string;
	action: 'place' | 'checkout' | 'collect' | 'condition';
	fields: [string, string][];
	count: number;
	at: string;
	/** Set when the server refused the action (e.g. a piece was already out). */
	error?: string;
};

const CATALOGUE_KEY = 'tracostume.scan-catalogue';
const QUEUE_KEY = 'tracostume.scan-queue';

function read<T>(key: string, fallback: T): T {
	if (!browser) return fallback;
	try {
		return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback;
	} catch {
		return fallback;
	}
}

function write(key: string, value: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Storage full or private mode: offline mode is just less useful.
	}
}

class OfflineScan {
	catalogue = $state<Catalogue | null>(read<Catalogue | null>(CATALOGUE_KEY, null));
	queue = $state<QueuedAction[]>(read<QueuedAction[]>(QUEUE_KEY, []));
	online = $state(browser ? navigator.onLine : true);
	syncing = $state(false);

	get pending() {
		return this.queue.filter((entry) => !entry.error);
	}

	get failed() {
		return this.queue.filter((entry) => entry.error);
	}

	/** Downloads the pieces and boxes for offline scans. */
	async refreshCatalogue() {
		try {
			const response = await fetch('/scan/catalogue');
			if (!response.ok) return;
			this.catalogue = await response.json();
			write(CATALOGUE_KEY, this.catalogue);
		} catch {
			// Offline: keep the copy we have.
		}
	}

	/** Resolves a scan from the copy on the phone. */
	lookup(value: string): ScanResult {
		const code = parseScannedCode(value);
		const item = this.catalogue?.items.find((candidate) => candidate.code === code);
		if (item) return { type: 'item', item };
		const box = this.catalogue?.boxes.find((candidate) => candidate.code === code);
		if (box) return { type: 'box', box };
		return { type: 'unknown', code };
	}

	enqueue(action: QueuedAction['action'], form: FormData) {
		const fields: [string, string][] = [];
		form.forEach((value, key) => fields.push([key, String(value)]));
		this.#save([
			...this.queue,
			{
				id: crypto.randomUUID(),
				action,
				fields,
				count: form.getAll('itemId').length,
				at: new Date().toISOString()
			}
		]);
	}

	/** Puts a refused action back in the queue, e.g. after signing in again. */
	retry(id: string) {
		this.#save(
			this.queue.map((entry) => (entry.id === id ? { ...entry, error: undefined } : entry))
		);
		return this.flush();
	}

	dismiss(id: string) {
		this.#save(this.queue.filter((entry) => entry.id !== id));
	}

	/** Sends the queued actions in order; stops at the first network failure. */
	async flush() {
		if (this.syncing || !this.pending.length) return 0;
		this.syncing = true;
		let sent = 0;
		try {
			for (const entry of this.pending) {
				const body = new FormData();
				for (const [key, value] of entry.fields) body.append(key, value);
				body.set('offlineAt', entry.at);
				let response: Response;
				try {
					response = await fetch(`/scan?/${entry.action}`, {
						method: 'POST',
						body,
						redirect: 'manual'
					});
				} catch {
					break;
				}
				// Actions answer 200, or 4xx when refused. A redirect means the session has expired.
				if (response.ok) {
					this.#save(this.queue.filter((other) => other.id !== entry.id));
					sent++;
				} else if (response.type === 'opaqueredirect' || response.status < 500) {
					// Refused (e.g. already out, or signed out): keep it visible for the user.
					const error = response.type === 'opaqueredirect' ? 'signedOut' : 'refused';
					this.#save(
						this.queue.map((other) => (other.id === entry.id ? { ...other, error } : other))
					);
				} else {
					break;
				}
			}
		} finally {
			this.syncing = false;
		}
		if (sent) await this.refreshCatalogue();
		return sent;
	}

	/** Forgets everything stored for the signed-in member (on sign-out). */
	clear() {
		this.catalogue = null;
		this.#save([]);
		try {
			localStorage.removeItem(CATALOGUE_KEY);
		} catch {
			// Nothing stored.
		}
	}

	#save(queue: QueuedAction[]) {
		this.queue = queue;
		write(QUEUE_KEY, queue);
	}
}

export const offlineScan = new OfflineScan();

if (browser) {
	addEventListener('online', () => {
		offlineScan.online = true;
		offlineScan.flush();
	});
	addEventListener('offline', () => (offlineScan.online = false));
}
