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
