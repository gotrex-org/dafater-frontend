export type EntryType = 'collect' | 'paySupplier' | 'expense' | 'cash' | 'transfer' | 'adjust' | 'unknownCollect' | 'deposit' | 'withdraw' | 'partyTransfer';

export type CashDir = 'out' | 'in';
export type CashTarget = 'client' | 'supplier' | 'warehouse' | 'external' | 'goods' | 'settlement' | 'account' | 'custody';
export type GoodsMode = 'invoices' | 'products' | 'count';
export interface GoodsItem { productId: string; count?: number }

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
  warehouseId?: string;
  cashDir?: CashDir;
  cashTarget?: CashTarget;
  holderName?: string;
  custodyDest?: 'treasury' | 'client' | 'category';
  goodsMode?: GoodsMode;
  invoiceIds?: string[];
  goodsItems?: GoodsItem[];
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
  createdBy?: { name: string } | null; // the user who recorded this movement
}

export interface UpdateTransactionDto {
  date?: string;
  amount?: number;
  note?: string;
  partyId?: string;
  treasuryId?: string;
}
