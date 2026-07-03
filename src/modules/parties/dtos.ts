export type PartyRole = 'CLIENT' | 'SUPPLIER' | 'AGENT';
export type PartyType = 'INVOICE' | 'LEDGER';

export interface LinkedPartyRef {
  id: string;
  uid: string;
  name: string;
  role: PartyRole;
}

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
  linkedParty?: LinkedPartyRef | null;
  linkedFrom?: LinkedPartyRef | null;
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
  partyRole?: PartyRole | null;
  partyName?: string | null;
  invoiceUid?: string | null;
  dealUid?: string | null;
  manifestDate?: string | null;
  manifestNo?: string | null;
  manifestArrived?: boolean;
  invoiceItems?: { name: string; qty: number; price: number }[] | null;
}

export interface LedgerStatement {
  party: Party;
  linkedParty?: LinkedPartyRef | null;
  opening: number;
  rows: LedgerRow[];
  balance: number;
}
