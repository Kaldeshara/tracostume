import { browser } from '$app/env';

// Items picked in the gallery or by scanning, kept across pages and app restarts so that
// a keeper can collect items in several passes before checking them out or locating them.
// Browser-only state: on the server this module is shared by all requests, so never mutate it there.

const STORAGE_KEY = 'tracostume.selection';

function load(): string[] {
	if (!browser) return [];
	try {
		const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
		return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
	} catch {
		return [];
	}
}

class Selection {
	ids = $state<string[]>(load());

	get size() {
		return this.ids.length;
	}

	has(id: string) {
		return this.ids.includes(id);
	}

	add(...ids: string[]) {
		this.#set([...new Set([...this.ids, ...ids])]);
	}

	remove(...ids: string[]) {
		this.#set(this.ids.filter((other) => !ids.includes(other)));
	}

	toggle(id: string) {
		if (this.has(id)) this.remove(id);
		else this.add(id);
	}

	clear() {
		this.#set([]);
	}

	#set(ids: string[]) {
		this.ids = ids;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
		} catch {
			// Private mode or storage full: the selection still works for this visit.
		}
	}
}

export const selection = new Selection();
