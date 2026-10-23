import { describe, expect, it } from 'vitest';
import type { BoxKind } from '../generated/prisma/enums';
import { freeFloorSpot, nearestRestLevel, overlapsXY, restLevels } from './map';

const box = (
	id: string,
	x: number,
	y: number,
	z = 0,
	w = 60,
	d = 40,
	h = 40,
	kind: BoxKind = 'PLASTIC_BOX'
) => ({ id, kind, posXCm: x, posYCm: y, posZCm: z, widthCm: w, depthCm: d, heightCm: h });

describe('overlapsXY', () => {
	it('detects overlapping footprints and ignores touching edges', () => {
		expect(overlapsXY(box('a', 0, 0), box('b', 30, 20))).toBe(true);
		expect(overlapsXY(box('a', 0, 0), box('b', 60, 0))).toBe(false);
	});
});

describe('restLevels / nearestRestLevel', () => {
	const rail = box('r', 0, 0, 0, 120, 45, 170, 'RACK');
	it('offers the floor and box tops under the footprint, never a clothes rail', () => {
		const others = [
			rail,
			box('b', 300, 0, 0),
			box('c', 10, 10, 0, 60, 40, 30),
			box('d', 10, 10, 30)
		];
		expect(restLevels(box('a', 10, 5), others)).toEqual([0, 30, 70]);
	});
	it('picks the level closest to the current height', () => {
		const others = [box('c', 10, 10, 0, 60, 40, 30), box('d', 10, 10, 30)];
		expect(nearestRestLevel(box('a', 10, 5, 60), others)).toBe(70);
		expect(nearestRestLevel(box('a', 10, 5, 10), others)).toBe(0);
		expect(nearestRestLevel(box('a', 300, 5, 100), others)).toBe(0);
	});
	it('keeps clothes rails on the floor', () => {
		expect(restLevels(box('r2', 0, 0, 50, 120, 45, 170, 'RACK'), [rail])).toEqual([0]);
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
