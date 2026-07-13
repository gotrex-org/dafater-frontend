export type ReminderKind = 'INSTALLMENT' | 'COLLECT' | 'PAY' | 'APPOINTMENT' | 'OTHER';
export type ReminderRecurrence = 'MONTHLY' | 'ONCE';

export interface Reminder {
  id: string;
  title: string;
  kind: ReminderKind;
  amount: number;
  recurrence: ReminderRecurrence;
  dayOfMonth?: number | null;
  date?: string | null;
  note?: string | null;
  doneMonth?: string | null;
  doneAt?: string | null;
  due: boolean;
  nextDate: string | null;
}

export interface CreateReminderDto {
  title: string;
  kind: ReminderKind;
  amount?: number;
  recurrence: ReminderRecurrence;
  dayOfMonth?: number;
  date?: string;
  note?: string;
}

export const REMINDER_KIND_LABEL: Record<ReminderKind, string> = {
  INSTALLMENT: 'قسط',
  COLLECT: 'نقدية تتحصّل',
  PAY: 'نقدية تتدفع',
  APPOINTMENT: 'موعد',
  OTHER: 'شخصي / أخرى',
};
