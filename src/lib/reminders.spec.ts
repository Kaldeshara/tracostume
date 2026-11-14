import { describe, expect, it } from 'vitest';
import { localDayAndHour, planReminders, type ReminderLoan } from './reminders';

const now = new Date('2026-11-02T08:00:00Z');
const loan = (fields: Partial<ReminderLoan>): ReminderLoan => ({
	borrowerUserId: 'lea',
	contactUserId: null,
	dueAt: null,
	collectedAt: null,
	...fields
});

describe('planReminders', () => {
	it('reminds borrowers, contacts and keepers', () => {
		const reminders = planReminders(
			[
				loan({ dueAt: new Date('2026-11-01T22:59:59Z'), contactUserId: 'chloe' }),
				loan({ dueAt: new Date('2026-11-02T20:00:00Z') }),
				loan({ dueAt: new Date('2026-11-20T20:00:00Z') }),
				loan({ borrowerUserId: null, dueAt: new Date('2026-10-30T20:00:00Z') })
			],
			['karim'],
			now
		);
		expect(reminders.get('lea')).toEqual({ overdue: 1, dueSoon: 1, toCollect: 0, allOverdue: 0 });
		expect(reminders.get('chloe')).toEqual({
			overdue: 0,
			dueSoon: 0,
			toCollect: 1,
			allOverdue: 0
		});
		expect(reminders.get('karim')?.allOverdue).toBe(2);
	});

	it('stops reminding the dancer once the piece is collected', () => {
		const reminders = planReminders(
			[loan({ dueAt: new Date('2026-10-30T20:00:00Z'), collectedAt: new Date() })],
			['karim'],
			now
		);
		expect(reminders.has('lea')).toBe(false);
		expect(reminders.get('karim')?.allOverdue).toBe(1);
	});
});

describe('localDayAndHour', () => {
	it('uses Paris time', () => {
		expect(localDayAndHour(new Date('2026-11-02T23:30:00Z'))).toEqual({
			day: '2026-11-03',
			hour: 0
		});
	});
});
