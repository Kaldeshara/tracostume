// Who gets which daily reminder about loans. Pure, so it is unit tested; sending is in
// #lib/server/reminders.ts.

export type ReminderLoan = {
	borrowerUserId: string | null;
	contactUserId: string | null;
	dueAt: Date | null;
	collectedAt: Date | null;
};

export type Reminder = {
	/** Pieces the member borrowed that are overdue. */
	overdue: number;
	/** Pieces the member borrowed that are due within a day. */
	dueSoon: number;
	/** Overdue pieces the member lent (as contact) and has not collected back yet. */
	toCollect: number;
	/** For keepers: every overdue loan. */
	allOverdue: number;
};

const DAY_MS = 24 * 3600 * 1000;

export function planReminders(loans: ReminderLoan[], keeperIds: string[], now: Date) {
	const reminders = new Map<string, Reminder>();
	const of = (userId: string) => {
		let reminder = reminders.get(userId);
		if (!reminder) {
			reminder = { overdue: 0, dueSoon: 0, toCollect: 0, allOverdue: 0 };
			reminders.set(userId, reminder);
		}
		return reminder;
	};

	let allOverdue = 0;
	for (const loan of loans) {
		if (!loan.dueAt) continue;
		const overdue = loan.dueAt < now;
		if (overdue) allOverdue++;
		// Once collected, the dancer has given the piece back: only the keepers still care.
		if (loan.collectedAt) continue;
		if (loan.borrowerUserId) {
			const soon = loan.dueAt.getTime() - now.getTime() < DAY_MS;
			if (overdue) of(loan.borrowerUserId).overdue++;
			else if (soon) of(loan.borrowerUserId).dueSoon++;
		}
		if (overdue && loan.contactUserId && loan.contactUserId !== loan.borrowerUserId) {
			of(loan.contactUserId).toCollect++;
		}
	}
	if (allOverdue) for (const keeperId of keeperIds) of(keeperId).allOverdue = allOverdue;
	return reminders;
}

/** Day (yyyy-mm-dd) and hour in the troupe's time zone. */
export function localDayAndHour(now: Date, timeZone = 'Europe/Paris') {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			hourCycle: 'h23'
		})
			.formatToParts(now)
			.map((part) => [part.type, part.value])
	);
	return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}
