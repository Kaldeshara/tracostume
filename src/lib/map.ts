import type { BoxKind, DoorSide } from '../generated/prisma/enums';

// Shared geometry helpers for the container map (page, scene and tests). Units are cm.

/** A 20 ft shipping container, used until the real container is measured. */
export const DEFAULT_CONTAINER = { widthCm: 590, depthCm: 235, heightCm: 239 };

export const BOX_KINDS: BoxKind[] = ['PLASTIC_BOX', 'CARDBOARD_BOX', 'CANVAS_BAG', 'RACK', 'OTHER'];
export const DOOR_SIDES: DoorSide[] = ['FRONT', 'BACK', 'LEFT', 'RIGHT'];

/** Typical size of each kind, used when a unit has no measurements. */
export const KIND_DEFAULTS: Record<
	BoxKind,
	{ widthCm: number; depthCm: number; heightCm: number }
> = {
	PLASTIC_BOX: { widthCm: 60, depthCm: 40, heightCm: 40 },
	CARDBOARD_BOX: { widthCm: 60, depthCm: 40, heightCm: 40 },
	CANVAS_BAG: { widthCm: 55, depthCm: 35, heightCm: 35 },
	// A clothes rail on wheels; clothes hang from its bar.
	RACK: { widthCm: 120, depthCm: 45, heightCm: 170 },
	OTHER: { widthCm: 60, depthCm: 40, heightCm: 40 }
};

export type Placed = {
	id: string;
	kind: BoxKind;
	posXCm: number;
	posYCm: number;
	posZCm: number;
	widthCm: number;
	depthCm: number;
	heightCm: number;
};

type Footprint = Pick<Placed, 'posXCm' | 'posYCm' | 'widthCm' | 'depthCm'>;

export function overlapsXY(a: Footprint, b: Footprint) {
	return (
		a.posXCm < b.posXCm + b.widthCm &&
		b.posXCm < a.posXCm + a.widthCm &&
		a.posYCm < b.posYCm + b.depthCm &&
		b.posYCm < a.posYCm + a.depthCm
	);
}

/**
 * Surfaces `box` can rest on within its footprint: the floor and the tops of other units.
 * Clothes rails stand on the floor and nothing rests on them.
 */
export function restLevels(box: Placed, others: Placed[]) {
	if (box.kind === 'RACK') return [0];
	const levels = new Set<number>([0]);
	for (const other of others) {
		if (other.id === box.id || other.kind === 'RACK' || !overlapsXY(box, other)) continue;
		levels.add(other.posZCm + other.heightCm);
	}
	return [...levels].sort((a, b) => a - b);
}

/** Level, among those `box` can rest on, closest to its current height. */
export function nearestRestLevel(box: Placed, others: Placed[]) {
	return restLevels(box, others).reduce((best, level) =>
		Math.abs(level - box.posZCm) < Math.abs(best - box.posZCm) ? level : best
	);
}

/** First floor spot, scanning from the back-left, where `box` fits without overlapping others. */
export function freeFloorSpot(
	box: { id: string; widthCm: number; depthCm: number; heightCm: number },
	others: Placed[],
	container: { widthCm: number; depthCm: number },
	step = 10
) {
	// Only units whose height range meets the floor level matter (shelf boxes do not block the floor).
	const blocking = others.filter((other) => other.id !== box.id && other.posZCm < box.heightCm);
	for (let posYCm = 0; posYCm + box.depthCm <= container.depthCm; posYCm += step) {
		for (let posXCm = 0; posXCm + box.widthCm <= container.widthCm; posXCm += step) {
			const candidate = { posXCm, posYCm, widthCm: box.widthCm, depthCm: box.depthCm };
			if (!blocking.some((other) => overlapsXY(candidate, other))) return { posXCm, posYCm };
		}
	}
	return { posXCm: 0, posYCm: 0 };
}
