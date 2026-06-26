export type EntryType = 'collect' | 'paySupplier' | 'expense' | 'transfer' | 'adjust' | 'unknownCollect' | 'deposit' | 'withdraw' | 'partyTransfer';

export interface PendingCollection {
  id: string;
  date: string;
  cashIn: number;
  expAmt?: number; // رسوم نقل مخزّنة وقت التحصيل (تُطبّق عند الترحيل)
  note?: string | null;
  treasury?: { name: string } | null;
}

export interface PostEntryDto {
  type: EntryType;
  date: string;
  amount: number;
  partyId?: string;
  partyId2?: string;
  treasuryId?: string;
  treasuryId2?: string;
  categoryId?: string;
  rate?: number;
  amount2?: number;
  direction?: 'debit' | 'credit';
  transferFee?: number;
  note?: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: string;
  note?: string | null;
  debit: number;
  credit: number;
  cashIn?: number;
  cashOut?: number;
  party?: { id: string; name: string } | null;
  treasury?: { id: string; name: string } | null;
  invoiceId?: string | null; // serialized to the invoice's public uid when linked
  dealId?: string | null;
}

export interface UpdateTransactionDto {
  date?: string;
  amount?: number;
  note?: string;
  partyId?: string;
  treasuryId?: string;
}
