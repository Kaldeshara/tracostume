import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/auth.ts';
import { prisma } from '#lib/server/db.ts';
import { vapidKeys } from '#lib/server/reminders.ts';

// Reminders on this phone: the key to subscribe with, then saving or removing the subscription.

const subscriptionSchema = z.object({
	endpoint: z.url().max(2000),
	keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
	locale: z.enum(['fr', 'en']).default('fr')
});

export const GET: RequestHandler = async (event) => {
	requireUser(event);
	return json({ publicKey: (await vapidKeys()).publicKey });
};

export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	const parsed = subscriptionSchema.safeParse(await event.request.json().catch(() => null));
	if (!parsed.success) error(400);
	const { endpoint, keys, locale } = parsed.data;
	const data = { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, locale };
	await prisma.pushSubscription.upsert({
		where: { endpoint },
		create: { endpoint, ...data },
		update: data
	});
	return json({ subscribed: true });
};

export const DELETE: RequestHandler = async (event) => {
	const user = requireUser(event);
	const body = await event.request.json().catch(() => null);
	const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
	await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
	return json({ subscribed: false });
};
