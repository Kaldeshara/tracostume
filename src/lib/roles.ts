import type { UserRole } from '../generated/prisma/enums';

const RANK: Record<UserRole, number> = { MEMBER: 0, KEEPER: 1, ADMIN: 2, OWNER: 3 };

export const ROLES: UserRole[] = ['MEMBER', 'KEEPER', 'ADMIN', 'OWNER'];

export function hasRole(role: UserRole | undefined | null, minimum: UserRole) {
	return role != null && RANK[role] >= RANK[minimum];
}

/** Keepers hold the container key: they can record entries, exits and edit items. */
export const canManageStock = (role: UserRole | undefined | null) => hasRole(role, 'KEEPER');

export const canManageUsers = (role: UserRole | undefined | null) => hasRole(role, 'ADMIN');
