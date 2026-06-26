export type Currency = 'EGP' | 'USD';

export interface TreasuryAccount {
  id: string;
  name: string;
  currency: Currency;
  opening: number;
  balance?: number;
}

export interface TreasuryMovement {
  id: string;
  date: string;
  type: string;
  note?: string | null;
  debit: number;
  credit: number;
  cashIn: number;
  cashOut: number;
  cashIn2: number;
  cashOut2: number;
  invoiceId?: string | null;
  dealId?: string | null;
  party?: { name: string } | null;
  treasury?: { id: string; name: string; currency: string } | null;
  treasury2?: { id: string; name: string; currency: string } | null;
}

export interface ExpenseByCategory {
  categoryId: string | null;
  category: string;
  total: number;
}

export interface TreasuryDto {
  name: string;
  currency?: Currency;
  opening?: number;
}
