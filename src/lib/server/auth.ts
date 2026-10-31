import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { error, redirect, type Cookies, type RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/env';
import { REGISTERING_PASSWORD } from '$app/env/private';
import type { UserRole } from '../../generated/prisma/enums';
import { hasRole } from '#lib/roles.ts';
import { prisma } from './db';

const SESSION_COOKIE = 'tracostume_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
// Extend the session when less than this much time is left, so active phones stay signed in.
const SESSION_RENEW_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15;

export type AuthUser = {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	name: string;
	role: UserRole;
};

function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
	cookies.set(SESSION_COOKIE, token, {
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		expires: expiresAt,
		path: '/'
	});
}

export async function createSession(cookies: Cookies, userId: string) {
	const token = randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
	// Expired sessions are only removed when they are used again: clear the others at each sign-in.
	await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
	await prisma.session.create({ data: { token, userId, expiresAt } });
	setSessionCookie(cookies, token, expiresAt);
}

export async function destroySession(cookies: Cookies) {
	const token = cookies.get(SESSION_COOKIE);
	if (token) {
		await prisma.session.deleteMany({ where: { token } });
	}
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function getSessionUser(cookies: Cookies): Promise<AuthUser | null> {
	const token = cookies.get(SESSION_COOKIE);
	if (!token) return null;

	const session = await prisma.session.findUnique({
		where: { token },
		include: {
			user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } }
		}
	});

	if (!session || session.expiresAt < new Date()) {
		if (session) await prisma.session.delete({ where: { id: session.id } });
		cookies.delete(SESSION_COOKIE, { path: '/' });
		return null;
	}

	if (session.expiresAt.getTime() - Date.now() < SESSION_RENEW_THRESHOLD_MS) {
		const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
		await prisma.session.update({ where: { id: session.id }, data: { expiresAt } });
		setSessionCookie(cookies, token, expiresAt);
	}

	const { user } = session;
	return { ...user, name: `${user.firstName} ${user.lastName}`.trim() };
}

export function requireUser(event: Pick<RequestEvent, 'locals' | 'url'>): AuthUser {
	const user = event.locals.user;
	if (!user) {
		redirect(303, `/login?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	}
	return user;
}

export function requireRole(
	event: Pick<RequestEvent, 'locals' | 'url'>,
	minimum: 'KEEPER' | 'ADMIN' | 'OWNER'
) {
	const user = requireUser(event);
	if (!hasRole(user.role, minimum)) {
		error(403, 'Forbidden');
	}
	return user;
}

/** Like requireRole, for one of the capability predicates of `#lib/roles.ts`. */
export function requireCapability(
	event: Pick<RequestEvent, 'locals' | 'url'>,
	allowed: (role: UserRole | null | undefined) => boolean
) {
	const user = requireUser(event);
	if (!allowed(user.role)) {
		error(403, 'Forbidden');
	}
	return user;
}

/** Only allow local redirect targets after login. */
export function safeNext(value: string | null) {
	return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export const isRegistrationPasswordRequired = () => REGISTERING_PASSWORD !== undefined;

const digest = (value: string) => createHash('sha256').update(value).digest();

export function registrationPasswordMatches(candidate: unknown) {
	if (REGISTERING_PASSWORD === undefined) return true;
	if (typeof candidate !== 'string') return false;
	return timingSafeEqual(digest(REGISTERING_PASSWORD), digest(candidate));
}
