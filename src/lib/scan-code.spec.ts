import { describe, expect, it } from 'vitest';
import { parseScannedCode } from './scan-code';

describe('parseScannedCode', () => {
	it('reads label URLs and raw codes', () => {
		expect(parseScannedCode('https://costumes.example.org/q/ab3x7k')).toBe('AB3X7K');
		expect(parseScannedCode(' b-4kd2 ')).toBe('B-4KD2');
	});
});
