export type PartyRole = 'CLIENT' | 'SUPPLIER' | 'AGENT';
export type PartyType = 'INVOICE' | 'LEDGER';

export interface Party {
  id: string;
  name: string;
  role: PartyRole;
  type?: PartyType | null;
  currency?: 'EGP' | 'USD';
  phone?: string | null;
  opening: number;
  hidden: boolean;
  balance?: number;
  lastActivity?: string | null;
}

export interface CreatePartyDto {
  name: string;
  role: PartyRole;
  type?: PartyType;
  currency?: 'EGP' | 'USD';
  phone?: string;
  opening?: number;
}

export type UpdatePartyDto = Partial<CreatePartyDto> & { hidden?: boolean };

export interface LedgerRow {
  id: string;
  date: string;
  type: string;
  note?: string | null;
  debit: number;
  credit: number;
  balance: number;
  invoiceUid?: string | null;
  dealUid?: string | null;
  invoiceItems?: { name: string; qty: number; price: number }[] | null;
}

export interface LedgerStatement {
  party: Party;
  opening: number;
  rows: LedgerRow[];
  balance: number;
}
