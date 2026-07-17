import type { Party } from '../parties/dtos';
import type { Product } from '../products/dtos';
import type { Warehouse } from '../warehouses/dtos';

export type InvoiceKind = 'SALE' | 'PURCHASE';

export interface InvoiceItem {
  id: string;
  productId: string;
  qty: number;
  price: number;
  freight?: number;
  freightTreasury?: { id: string; name: string } | null;
  freightNote?: string | null;
  tea?: number;
  teaTreasury?: { id: string; name: string } | null;
  teaNote?: string | null;
  commission?: number;
  commissionQty?: number;
  commissionPrice?: number;
  commissionParty?: { id: string; name: string } | null;
  product?: Product;
}

export interface Invoice {
  id: string;
  kind: InvoiceKind;
  no: string;
  date: string;
  currency?: 'EGP' | 'USD';
  exchangeRate?: number | null;
  partyId: string;
  warehouseId: string;
  paid: number;
  discount?: number;
  fake?: boolean;
  note?: string | null;
  party?: Party;
  warehouse?: Warehouse;
  items: InvoiceItem[];
}

export interface CreateInvoiceItemDto {
  productId: string;
  qty: number;
  price: number;
  freight?: number;
  freightTreasuryId?: string;
  freightNote?: string;
  tea?: number;
  teaTreasuryId?: string;
  teaNote?: string;
  commissionQty?: number;
  commissionPrice?: number;
  commissionPartyId?: string;
}

export interface CreateInvoiceDto {
  kind: InvoiceKind;
  no?: string; // omitted → backend auto-numbers per kind
  date: string;
  partyId: string;
  warehouseId: string;
  items: CreateInvoiceItemDto[];
  paid?: number;
  discount?: number;
  fake?: boolean;
  treasuryId?: string;
  note?: string;
  exchangeRate?: number;
  commissionAmount?: number;
  commissionPartyId?: string;
}

export interface UpdateInvoiceDto {
  date: string;
  partyId: string;
  warehouseId: string;
  items: CreateInvoiceItemDto[];
  paid?: number;
  discount?: number;
  fake?: boolean;
  treasuryId?: string;
  note?: string;
  exchangeRate?: number;
  commissionAmount?: number;
  commissionPartyId?: string;
}
