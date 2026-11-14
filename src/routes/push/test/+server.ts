import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { m } from '#lib/paraglide/messages.js';
import { requireUser } from '#lib/server/auth.ts';
import { notifyUser } from '#lib/server/reminders.ts';

/** Sends a test notification to the member's devices. */
export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	const sent = await notifyUser(user.id, (locale) => ({
		title: m.push_test_title({}, { locale }),
		body: m.push_test_body({}, { locale }),
		url: '/account'
	}));
	return json({ sent });
};
