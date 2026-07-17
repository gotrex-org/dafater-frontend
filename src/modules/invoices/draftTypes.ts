import type { InvoiceKind } from './dtos';

// A minimized (still-open) invoice being edited. The whole editor state is captured
// as plain serializable data so the draft can survive navigation between pages — the
// user can leave the Invoices screen, go to the ledger, then come back and finish it.
export interface InvoiceDraftLine {
  productId: string;
  qty: string;
  price: string;
  bnd?: boolean;
  freight?: string;
  freightTreasuryId?: string;
  freightNote?: string;
  tea?: string;
  teaTreasuryId?: string;
  teaNote?: string;
  commQty?: string;
  commPrice?: string;
  commPartyId?: string;
}

export interface InvoiceDraftState {
  no: string;
  date: string;
  partyId: string;
  directSale: boolean;
  warehouseId: string;
  treasuryId: string;
  paid: string;
  note: string;
  exchangeRate: string;
  lines: InvoiceDraftLine[];
}

export interface InvoiceDraft {
  id: string;
  kind: InvoiceKind;
  /** set when editing an existing invoice (vs. creating a new one) */
  invoiceId?: string;
  /** short label shown on the minimized chip */
  title: string;
  updatedAt: number;
  state: InvoiceDraftState;
}
