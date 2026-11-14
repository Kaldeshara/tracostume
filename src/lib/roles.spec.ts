import { describe, expect, it } from 'vitest';
import { canCheckOut, canManageStock, canOpenPage, canSeeLists } from './roles';

describe('canOpenPage', () => {
	it('opens a single unit to every member, since anyone can scan its label', () => {
		for (const role of ['DANCER', 'REPAIRER', 'CHOREOGRAPHER', 'KEEPER'] as const)
			expect(canOpenPage(role, '/boxes/abc')).toBe(true);
	});

	it('keeps the list of units and the map for those who see the container', () => {
		expect(canOpenPage('DANCER', '/boxes')).toBe(false);
		expect(canOpenPage('REPAIRER', '/map')).toBe(false);
		expect(canOpenPage('CHOREOGRAPHER', '/boxes')).toBe(true);
	});

	it('keeps labels, piece creation and editing for keepers', () => {
		expect(canOpenPage('CHOREOGRAPHER', '/labels')).toBe(false);
		expect(canOpenPage('KEEPER', '/labels')).toBe(true);
		expect(canOpenPage('DANCER', '/items/new')).toBe(false);
		expect(canOpenPage('DANCER', '/items/x/edit')).toBe(false);
		expect(canOpenPage('KEEPER', '/items/x/edit')).toBe(true);
	});

	it('keeps members and container settings for admins', () => {
		expect(canOpenPage('KEEPER', '/users')).toBe(false);
		expect(canOpenPage('ADMIN', '/container')).toBe(true);
	});

	it('keeps sets and show lists for those who may see them', () => {
		expect(canOpenPage('REPAIRER', '/lists')).toBe(canSeeLists('REPAIRER'));
		expect(canOpenPage('KEEPER', '/lists/x')).toBe(true);
	});

	it('leaves the rest open', () => {
		expect(canOpenPage('DANCER', '/items')).toBe(true);
		expect(canOpenPage('REPAIRER', '/scan')).toBe(true);
	});
});

describe('unit actions', () => {
	it('lets keepers put in and check, and choreographers only lend', () => {
		expect(canManageStock('KEEPER')).toBe(true);
		expect(canManageStock('CHOREOGRAPHER')).toBe(false);
		expect(canCheckOut('CHOREOGRAPHER')).toBe(true);
		expect(canCheckOut('DANCER')).toBe(false);
		expect(canManageStock('REPAIRER')).toBe(false);
	});
});
