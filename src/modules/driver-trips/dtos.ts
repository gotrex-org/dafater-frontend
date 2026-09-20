export interface DriverPayment {
  id: string;
  date: string;
  amount: number;
  paymentType: 'freight' | 'delay' | 'tea' | 'weightDiff' | 'advance';
  note?: string | null;
  createdAt: string;
}

export interface DriverTrip {
  id: string;
  manifestId?: number | null;
  manifest?: { uid: string; no: string } | null;
  party?: { id: string; name: string } | null;
  driverName: string;
  vehicleNo?: string | null;
  /** مسمّى العربية (عربية الزيتون / عربية ديدي) */
  vehicleLabel?: string | null;
  trailerNo?: string | null;
  clientName: string;
  departureDate: string;
  agreedFreight: number;
  delayFee: number;
  weightDiffAmount: number;
  note?: string | null;
  arrivalDate?: string | null;
  delayTxId?: number | null;
  weightDiffTxId?: number | null;
  payments: DriverPayment[];
  createdAt: string;
  // computed by findAll
  totalFreightPaid?: number;
  totalDelayPaid?: number;
  totalAdvancePaid?: number;
  totalWeightDiffPaid?: number;
  remainingFreight?: number;
  remainingDelay?: number;
  remainingWeightDiff?: number;
  trulyClosed?: boolean;
  // الفاتورة المربوطة — اللي الناولون اتحصّل فيها من العميل
  invoiceId?: number | null;
  invoice?: { uid: string; no: string; date: string; items: { qty: number; price: number; product: { name: string } | null }[] } | null;
  collectedFreight?: number;
  collectedLines?: TripInvoiceLine[];
  tripProfit?: number;
}

export interface CreateDriverTripDto {
  manifestId?: string;
  partyId?: string;
  driverName: string;
  vehicleNo?: string;
  vehicleLabel?: string;
  trailerNo?: string;
  clientName?: string;
  departureDate: string;
  agreedFreight: number;
  note?: string;
  initialPaid?: number;
  initialPaidNote?: string;
  initialPaidTreasuryId?: string;
  teaMoney?: number;
  teaTreasuryId?: string;
}

export interface UpdateDriverTripDto {
  /** ربط الرحلة بكشف عربية — سلسلة فاضية معناها فك الربط */
  manifestId?: string;
  partyId?: string;
  driverName?: string;
  vehicleNo?: string;
  vehicleLabel?: string;
  trailerNo?: string;
  clientName?: string;
  departureDate?: string;
  agreedFreight?: number;
  note?: string;
}

export interface AddPaymentDto {
  date: string;
  amount: number;
  note?: string;
  paymentType?: 'freight' | 'delay' | 'weightDiff' | 'advance';
  treasuryId?: string;
  weightDiffAmount?: number;
}

/** بند خدمة على الفاتورة المربوطة — ناولون/تحميل/شفتنة… */
export interface TripInvoiceLine { name: string; total: number; }

/** فاتورة بيع ينفع الرحلة تتربط بيها */
export interface TripInvoiceCandidate {
  uid: string;
  no: string;
  date: string;
  items: { qty: number; price: number; product: { name: string } | null }[];
}
