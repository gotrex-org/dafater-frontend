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

// أرقام "شكل الشيت" للفاتورة — بتيجي من GET /invoices/:id/sheet
export interface InvoiceSheetPayment {
  id: string;
  date: string;
  type: string;
  note: string | null;
  amount: number;
}

export interface InvoiceSheet {
  /** الحساب القديم: رصيد الطرف قبل الفاتورة دي مباشرة */
  previousBalance: number;
  /** نقل نقدية: رسوم نقل النقدية المتسجّلة مع التحصيل في نفس الفترة */
  cashTransfer: number;
  /** الباقي عليه: الرصيد بعد الفاتورة وسداداتها */
  remaining: number;
  /** سدادات الفترة: من الفاتورة دي لحد الفاتورة اللي بعدها */
  payments: InvoiceSheetPayment[];
  paymentsTotal: number;
  nextInvoiceNo: string | null;
  currency: 'EGP' | 'USD';
}

// ---- تابات العربيات جوّه الفاتورة (GET /invoices/:id/manifest-tabs) ----

export interface ManifestTabItem {
  id: string;
  name: string;
  qty: number;
  /** السعر من بند الفاتورة اللي بنفس اسم الصنف — null لو مفيش بند مطابق */
  price: number | null;
  total: number | null;
}

export interface ManifestTabExpense {
  id: string;
  date: string;
  type: string;
  note: string | null;
  category: string | null;
  treasury: string | null;
  amount: number;
  /** متثبّت على العربية دي (اتضاف من التاب) — مش داخل بالنافذة الزمنية */
  pinned: boolean;
}

export interface ManifestTab {
  id: string;
  no: string;
  date: string;
  vehicleNo?: string | null;
  vehicleLabel?: string | null;
  driverName?: string | null;
  note?: string | null;
  closedAt: string | null;
  closedBy: string | null;
  /** بداية النافذة الزمنية للمصاريف (تاريخ العربية اللي قبلها أو تاريخ الفاتورة) */
  from: string;
  /** نهايتها — null يعني التاب لسه مفتوح وبياخد أي مصروف جديد */
  to: string | null;
  items: ManifestTabItem[];
  itemsTotal: number;
  expenses: ManifestTabExpense[];
  expensesTotal: number;
}

export interface ManifestTabs {
  currency: 'EGP' | 'USD';
  invoiceNo: string;
  tabs: ManifestTab[];
}
