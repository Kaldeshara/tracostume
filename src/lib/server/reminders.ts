import { m } from '#lib/paraglide/messages.js';
import { canSeeAllLoans } from '#lib/roles.ts';
import { localDayAndHour, planReminders, type Reminder } from '#lib/reminders.ts';
import { prisma } from './db';
import { generateVapidKeys, sendPush, type VapidKeys } from './web-push';

// Daily Web Push reminders about loans, sent from the app process itself (no cron needed):
// a timer checks every quarter of an hour and sends once a day after REMINDER_HOUR, Paris time.

const REMINDER_HOUR = 9;
const CHECK_EVERY_MS = 15 * 60 * 1000;

let keys: Promise<VapidKeys> | undefined;

/** The server's VAPID keys, created and stored on first use. */
export function vapidKeys() {
	keys ??= (async () => {
		const stored = await prisma.pushKeys.findUnique({ where: { id: 1 } });
		if (stored) return stored;
		const created = generateVapidKeys();
		// Another process may have created them meanwhile: keep whichever was stored first.
		await prisma.pushKeys.createMany({ data: [{ id: 1, ...created }], skipDuplicates: true });
		return prisma.pushKeys.findUniqueOrThrow({ where: { id: 1 } });
	})().catch((err) => {
		keys = undefined;
		throw err;
	});
	return keys;
}

async function contactSubject() {
	const owner = await prisma.user.findFirst({
		where: { role: 'OWNER' },
		orderBy: { createdAt: 'asc' },
		select: { email: true }
	});
	return `mailto:${owner?.email ?? 'admin@example.com'}`;
}

export type PushMessage = { title: string; body: string; url: string };

/** Sends to every device of a member; forgets devices that unsubscribed. */
export async function notifyUser(userId: string, message: (locale: 'fr' | 'en') => PushMessage) {
	const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
	if (!subscriptions.length) return 0;
	const [vapid, subject] = await Promise.all([vapidKeys(), contactSubject()]);
	let sent = 0;
	for (const subscription of subscriptions) {
		const locale = subscription.locale === 'en' ? 'en' : 'fr';
		try {
			const status = await sendPush(subscription, message(locale), vapid, subject);
			if (status === 404 || status === 410) {
				await prisma.pushSubscription.delete({ where: { id: subscription.id } });
			} else if (status < 300) {
				sent++;
			} else {
				console.warn(`Push refused (${status}) for ${new URL(subscription.endpoint).host}`);
			}
		} catch (err) {
			console.warn('Push failed', err);
		}
	}
	return sent;
}

function reminderMessage(reminder: Reminder, locale: 'fr' | 'en'): PushMessage {
	const options = { locale };
	const lines = [
		reminder.overdue && m.push_overdue({ count: reminder.overdue }, options),
		reminder.dueSoon && m.push_due_soon({ count: reminder.dueSoon }, options),
		reminder.toCollect && m.push_to_collect({ count: reminder.toCollect }, options),
		reminder.allOverdue && m.push_all_overdue({ count: reminder.allOverdue }, options)
	].filter((line) => typeof line === 'string');
	return { title: m.push_reminder_title({}, options), body: lines.join('\n'), url: '/loans' };
}

/** Sends today's reminders unless they were already sent. Returns the number of notifications. */
export async function sendDailyReminders(now = new Date()) {
	const { day } = localDayAndHour(now);
	const claimed = await prisma.reminderRun.createMany({ data: [{ day }], skipDuplicates: true });
	if (!claimed.count) return 0;

	const [loans, staff, subscribers] = await Promise.all([
		prisma.loan.findMany({
			where: { returnedAt: null, dueAt: { not: null } },
			select: { borrowerUserId: true, contactUserId: true, dueAt: true, collectedAt: true }
		}),
		prisma.user.findMany({ select: { id: true, role: true } }),
		prisma.pushSubscription.findMany({ select: { userId: true }, distinct: ['userId'] })
	]);
	const keeperIds = staff.filter((user) => canSeeAllLoans(user.role)).map((user) => user.id);
	const reminders = planReminders(loans, keeperIds, now);

	let sent = 0;
	for (const { userId } of subscribers) {
		const reminder = reminders.get(userId);
		if (reminder) sent += await notifyUser(userId, (locale) => reminderMessage(reminder, locale));
	}
	return sent;
}

let timer: ReturnType<typeof setInterval> | undefined;

/** Starts the daily reminder timer (once per process). */
export function startReminders() {
	if (timer) return;
	const check = () => {
		if (localDayAndHour(new Date()).hour < REMINDER_HOUR) return;
		sendDailyReminders().catch((err) => console.error('Loan reminders failed', err));
	};
	timer = setInterval(check, CHECK_EVERY_MS);
	timer.unref?.();
	check();
}
