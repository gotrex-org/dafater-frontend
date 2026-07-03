export interface DriverPayment {
  id: string;
  date: string;
  amount: number;
  paymentType: 'freight' | 'delay' | 'tea' | 'weightDiff';
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
  totalWeightDiffPaid?: number;
  remainingFreight?: number;
  remainingDelay?: number;
  remainingWeightDiff?: number;
  trulyClosed?: boolean;
}

export interface CreateDriverTripDto {
  manifestId?: string;
  partyId?: string;
  driverName: string;
  vehicleNo?: string;
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
  partyId?: string;
  driverName?: string;
  vehicleNo?: string;
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
  paymentType?: 'freight' | 'delay' | 'weightDiff';
  treasuryId?: string;
  weightDiffAmount?: number;
}
