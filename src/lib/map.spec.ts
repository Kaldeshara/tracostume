import { describe, expect, it } from 'vitest';
import { freeFloorSpot, overlapsXY, stackHeight } from './map';

const box = (id: string, x: number, y: number, z = 0, w = 60, d = 40, h = 40) => ({
	id,
	posXCm: x,
	posYCm: y,
	posZCm: z,
	widthCm: w,
	depthCm: d,
	heightCm: h
});

describe('overlapsXY', () => {
	it('detects overlapping footprints and ignores touching edges', () => {
		expect(overlapsXY(box('a', 0, 0), box('b', 30, 20))).toBe(true);
		expect(overlapsXY(box('a', 0, 0), box('b', 60, 0))).toBe(false);
	});
});

describe('stackHeight', () => {
	it('rests on the tallest box under the footprint', () => {
		const others = [box('b', 10, 10, 0), box('c', 10, 10, 40, 60, 40, 30), box('d', 300, 0, 0)];
		expect(stackHeight(box('a', 0, 0), others)).toBe(70);
		expect(stackHeight(box('a', 200, 0), others)).toBe(0);
	});
});

describe('freeFloorSpot', () => {
	it('skips occupied floor space but not boxes up on shelves', () => {
		const container = { widthCm: 200, depthCm: 100 };
		expect(freeFloorSpot(box('a', 0, 0), [box('b', 0, 0)], container)).toEqual({
			posXCm: 60,
			posYCm: 0
		});
		expect(freeFloorSpot(box('a', 0, 0), [box('b', 0, 0, 150)], container)).toEqual({
			posXCm: 0,
			posYCm: 0
		});
	});
});
