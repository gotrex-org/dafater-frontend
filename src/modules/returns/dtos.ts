import type { Party } from '../parties/dtos';
import type { Product } from '../products/dtos';
import type { Warehouse } from '../warehouses/dtos';
import type { InvoiceKind } from '../invoices/dtos';

export interface ReturnItem {
  id: string;
  qty: number;
  price: number;
  product?: Product;
}

export interface ReturnDoc {
  id: string;
  kind: InvoiceKind;
  no: string;
  date: string;
  refund: number;
  note?: string | null;
  party?: Party;
  warehouse?: Warehouse;
  treasury?: { id: string; name: string } | null;
  invoice?: { id: string; no: string; kind: InvoiceKind } | null;
  items: ReturnItem[];
}

export interface CreateReturnItemDto {
  productId: string;
  qty: number;
  price: number;
}

export interface CreateReturnDto {
  kind: InvoiceKind;
  no?: string;
  date: string;
  partyId: string;
  warehouseId: string;
  invoiceId?: string;
  items: CreateReturnItemDto[];
  refund?: number;
  treasuryId?: string;
  note?: string;
}
