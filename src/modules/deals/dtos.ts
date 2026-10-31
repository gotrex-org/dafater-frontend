import type { CreateInvoiceChargeDto, InvoiceCharge } from '../invoices/dtos';

export interface DealItem {
  id?: string;
  productId: string;
  qty: number;
  price: number; // sell
  buyPrice?: number;
  product?: { id: string; name: string; service?: boolean };
  // تكاليف إضافية على البند (زي الفواتير — ناولون خارجي/شاي/عمولة)
  freight?: number;
  freightTreasuryId?: string;
  freightNote?: string | null;
  freightTreasury?: { id: string; name: string } | null;
  tea?: number;
  teaTreasuryId?: string;
  teaNote?: string | null;
  teaTreasury?: { id: string; name: string } | null;
  commissionQty?: number;
  commissionPrice?: number;
  commissionPartyId?: string;
  commissionParty?: { id: string; name: string } | null;
}

export interface Deal {
  id: string;
  no: string;
  date: string;
  clientId: string;
  supplierId: string;
  paidIn: number;
  paidOut: number;
  nawlon: number;
  note?: string | null;
  /** سعر صرف الدولار لما المورد دولاري */
  exchangeRate?: number | null;
  client?: { id: string; name: string; currency?: 'EGP' | 'USD' };
  supplier?: { id: string; name: string; currency?: 'EGP' | 'USD' };
  treasury?: { id: string; name: string } | null;
  items: DealItem[];
  /** بنود الشحن على العميل — نفس شكل بنود الفاتورة */
  charges?: InvoiceCharge[];
  /** كشوفات العربيات المربوطة بالعملية */
  manifests?: { id: string; no: string; date: string; vehicleNo?: string | null; driverName?: string | null }[];
  /** رحلة السائق المربوطة بالعملية */
  driverTrip?: { id: string; driverName: string; departureDate: string } | null;
}

export interface CreateDealDto {
  no?: string;
  date: string;
  clientId: string;
  supplierId: string;
  items: DealItem[];
  charges?: CreateInvoiceChargeDto[];
  paidIn?: number;
  paidOut?: number;
  treasuryId?: string;
  note?: string;
  exchangeRate?: number;
  commissionAmount?: number;
  commissionPartyId?: string;
  nawlon?: number;
}
