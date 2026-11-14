import type { UserRole } from '../generated/prisma/enums';

// What each role may do. Keepers hold the container key; admins also manage members;
// choreographers stand between the keeper and the dancers; repairers only see what needs care.

export const ROLES: UserRole[] = [
	'DANCER',
	'REPAIRER',
	'CHOREOGRAPHER',
	'KEEPER',
	'ADMIN',
	'OWNER'
];

const STOCK: UserRole[] = ['KEEPER', 'ADMIN', 'OWNER'];
const ADMINS: UserRole[] = ['ADMIN', 'OWNER'];

type Role = UserRole | undefined | null;
const is = (role: Role, roles: UserRole[]) => role != null && roles.includes(role);

/** Minimum-role check along the keeper → admin → owner ladder. */
export function hasRole(role: Role, minimum: 'KEEPER' | 'ADMIN' | 'OWNER') {
	const ladders: Record<typeof minimum, UserRole[]> = {
		KEEPER: STOCK,
		ADMIN: ADMINS,
		OWNER: ['OWNER']
	};
	return is(role, ladders[minimum]);
}

/** Record entries, moves, condition changes; create and edit pieces, boxes and the map. */
export const canManageStock = (role: Role) => is(role, STOCK);

/** Change members' roles. */
export const canManageUsers = (role: Role) => is(role, ADMINS);

/** Lend pieces to dancers. */
export const canCheckOut = (role: Role) => is(role, [...STOCK, 'CHOREOGRAPHER']);

/** Record a piece handed back by a dancer (not yet in the container). */
export const canCollect = (role: Role) => is(role, [...STOCK, 'CHOREOGRAPHER']);

/** See boxes, the map and the labels. */
export const canSeeContainer = (role: Role) => is(role, [...STOCK, 'CHOREOGRAPHER']);

/** Change a piece's condition (repairers only among the repair states, see stock actions). */
export const canSetCondition = (role: Role) => is(role, [...STOCK, 'REPAIRER']);

/** Sees only the pieces that need washing or repair. */
export const isRepairer = (role: Role) => role === 'REPAIRER';

/** See every loan, not just one's own. */
export const canSeeAllLoans = (role: Role) => is(role, STOCK);

/** See costume sets and show lists (repairers only see pieces that need care). */
export const canSeeLists = (role: Role) => role != null && role !== 'REPAIRER';

/** Create and edit costume sets and show lists. */
export const canEditLists = (role: Role) => is(role, [...STOCK, 'CHOREOGRAPHER']);

// Pages reserved to some roles; everything else is open to every signed-in member. A single
// storage unit (/boxes/<id>) is open to all: every member can scan a unit's label (its actions
// check their own access). The list of units, the map and unit editing stay restricted.
const RESTRICTED_PAGES: [prefix: string, allowed: (role: Role) => boolean][] = [
	['/users', canManageUsers],
	['/container', canManageUsers],
	['/labels', canManageStock],
	['/items/new', canManageStock],
	['/map', canSeeContainer],
	['/lists', canSeeLists]
];
const EDIT_ITEM = /^\/items\/[^/]+\/edit$/;
const UNIT_PAGE = /^\/boxes\/[^/]+$/;

/** Whether a signed-in member may open a page (enforced in hooks.server.ts). */
export function canOpenPage(role: Role, pathname: string): boolean {
	if (pathname === '/boxes' || (pathname.startsWith('/boxes/') && !UNIT_PAGE.test(pathname)))
		return canSeeContainer(role) || /^\/boxes\/[^/]+\/candidates$/.test(pathname);
	if (EDIT_ITEM.test(pathname)) return canManageStock(role);
	const rule = RESTRICTED_PAGES.find(
		([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/')
	);
	return rule ? rule[1](role) : true;
}
