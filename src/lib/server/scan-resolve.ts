// What a scanned or typed code opens. Order matters for printed labels (constitution
// Principle I): old piece codes first, then storage units, then the container.

type Found = { id: string } | null;

export type CodeLookups = {
	item: (code: string) => Promise<Found>;
	box: (code: string) => Promise<Found>;
	container: (code: string) => Promise<Found>;
};

export type ScanTarget = { type: 'item' | 'box' | 'container'; id: string };

export async function resolveScannedCode(
	code: string,
	lookups: CodeLookups
): Promise<ScanTarget | null> {
	for (const type of ['item', 'box', 'container'] as const) {
		const found = await lookups[type](code);
		if (found) return { type, id: found.id };
	}
	return null;
}
