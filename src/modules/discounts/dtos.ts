import type { Party } from '../parties/dtos';

export interface Discount {
  id: string;
  date: string;
  amount: number;
  note?: string | null;
  party?: Party;
}

export interface CreateDiscountDto {
  date: string;
  partyId: string;
  amount: number;
  note?: string;
}

export type DiscountRecurrence = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface DiscountSchedule {
  id: string;
  amount: number;
  percent: number;
  recurrence: DiscountRecurrence;
  startDate: string;
  note?: string | null;
  active: boolean;
  lastApplied?: string | null;
  party?: Party;
}

export interface CreateDiscountScheduleDto {
  partyId: string;
  amount?: number;
  percent?: number;
  recurrence: DiscountRecurrence;
  startDate: string;
  note?: string;
}

export const DISCOUNT_RECURRENCE_LABEL: Record<DiscountRecurrence, string> = {
  MONTHLY: 'شهري',
  QUARTERLY: 'ربع سنوي',
  YEARLY: 'سنوي',
};
