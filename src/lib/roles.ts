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
