import { describe, expect, it } from 'vitest';
import { FailureLimiter } from './rate-limit';

describe('FailureLimiter', () => {
	it('blocks after the maximum number of failures until the oldest one expires', () => {
		const limiter = new FailureLimiter(3, 1000);
		limiter.fail('a', 0);
		limiter.fail('a', 100);
		expect(limiter.retryAfter('a', 200)).toBe(0);
		limiter.fail('a', 200);
		expect(limiter.retryAfter('a', 300)).toBe(700);
		expect(limiter.retryAfter('a', 1000)).toBe(0);
	});

	it('keeps keys apart and forgets a key on reset', () => {
		const limiter = new FailureLimiter(1, 1000);
		limiter.fail('a', 0);
		expect(limiter.retryAfter('b', 0)).toBe(0);
		expect(limiter.retryAfter('a', 0)).toBe(1000);
		limiter.reset('a');
		expect(limiter.retryAfter('a', 0)).toBe(0);
	});
});
