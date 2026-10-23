// Shared geometry helpers for the container map (page and tests).

/** A 20 ft shipping container, used until the real container is measured. */
export const DEFAULT_CONTAINER = { widthCm: 590, depthCm: 235, heightCm: 239 };
export const DEFAULT_BOX = { widthCm: 60, depthCm: 40, heightCm: 40 };

export type Placed = {
	id: string;
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

/** Height at which `box` rests on top of whatever is under its footprint (0 = floor). */
export function stackHeight(box: Placed, others: Placed[]) {
	return others
		.filter((other) => other.id !== box.id && overlapsXY(box, other))
		.reduce((top, other) => Math.max(top, other.posZCm + other.heightCm), 0);
}

/** First floor spot, scanning from the back-left, where `box` fits without overlapping others. */
export function freeFloorSpot(
	box: { id: string; widthCm: number; depthCm: number; heightCm: number },
	others: Placed[],
	container: { widthCm: number; depthCm: number },
	step = 10
) {
	// Only boxes whose height range meets the floor level matter (shelf boxes do not block the floor).
	const blocking = others.filter((other) => other.id !== box.id && other.posZCm < box.heightCm);
	for (let posYCm = 0; posYCm + box.depthCm <= container.depthCm; posYCm += step) {
		for (let posXCm = 0; posXCm + box.widthCm <= container.widthCm; posXCm += step) {
			const candidate = { posXCm, posYCm, widthCm: box.widthCm, depthCm: box.depthCm };
			if (!blocking.some((other) => overlapsXY(candidate, other))) return { posXCm, posYCm };
		}
	}
	return { posXCm: 0, posYCm: 0 };
}
