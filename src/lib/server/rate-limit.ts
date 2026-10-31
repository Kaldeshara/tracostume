// Counts failed attempts per key (an email, an IP address) in a sliding window, in memory.
// The app runs as a single Node process, so memory is enough; a restart only forgets counts.

export class FailureLimiter {
	#failures = new Map<string, number[]>();

	constructor(
		readonly maxFailures: number,
		readonly windowMs: number
	) {}

	#recent(key: string, now: number) {
		const times = (this.#failures.get(key) ?? []).filter((time) => now - time < this.windowMs);
		if (times.length) this.#failures.set(key, times);
		else this.#failures.delete(key);
		return times;
	}

	/** Milliseconds until `key` may try again, 0 when it is not blocked. */
	retryAfter(key: string, now = Date.now()) {
		const times = this.#recent(key, now);
		if (times.length < this.maxFailures) return 0;
		return times[times.length - this.maxFailures] + this.windowMs - now;
	}

	fail(key: string, now = Date.now()) {
		const times = this.#recent(key, now);
		times.push(now);
		this.#failures.set(key, times.slice(-this.maxFailures));
	}

	reset(key: string) {
		this.#failures.delete(key);
	}
}

/**
 * Failed sign-ins per email: 5 per quarter of an hour, enough to stop password guessing. Not per
 * IP address: behind the host's proxy, and on a shared Wi-Fi, every member may have the same one.
 */
export const loginFailures = new FailureLimiter(5, 15 * 60 * 1000);
