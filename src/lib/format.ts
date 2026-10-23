import { getLocale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/paraglide/messages.js';
import type { ItemCondition, MovementType, UserRole } from '../generated/prisma/enums';

const intlLocale = () => (getLocale() === 'fr' ? 'fr-FR' : 'en-GB');

export function formatDate(value: Date | string | null | undefined) {
	if (!value) return '';
	return new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium' }).format(new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined) {
	if (!value) return '';
	return new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
		new Date(value)
	);
}

/** yyyy-mm-dd for <input type="date">. */
export function toDateInput(value: Date | string | null | undefined) {
	if (!value) return '';
	const date = new Date(value);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isOverdue(dueAt: Date | string | null | undefined) {
	return !!dueAt && new Date(dueAt).getTime() < Date.now();
}

export const CONDITIONS: ItemCondition[] = [
	'GOOD',
	'TO_WASH',
	'TO_REPAIR',
	'IN_REPAIR',
	'DAMAGED',
	'LOST',
	'RETIRED'
];

export function conditionLabel(condition: ItemCondition) {
	return {
		GOOD: m.condition_good,
		TO_WASH: m.condition_to_wash,
		TO_REPAIR: m.condition_to_repair,
		IN_REPAIR: m.condition_in_repair,
		DAMAGED: m.condition_damaged,
		LOST: m.condition_lost,
		RETIRED: m.condition_retired
	}[condition]();
}

export function roleLabel(role: UserRole) {
	return {
		MEMBER: m.role_member,
		KEEPER: m.role_keeper,
		ADMIN: m.role_admin,
		OWNER: m.role_owner
	}[role]();
}

export function movementLabel(type: MovementType) {
	return {
		CREATED: m.movement_created,
		STORED: m.movement_stored,
		MOVED: m.movement_moved,
		CHECKED_OUT: m.movement_checked_out,
		RETURNED: m.movement_returned,
		CONDITION_CHANGED: m.movement_condition_changed
	}[type]();
}
