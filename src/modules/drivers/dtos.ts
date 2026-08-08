export interface Driver {
  id: string;
  name: string;
  nationalId?: string | null;
  phone?: string | null;
  phone2?: string | null;
  vehicleNo?: string | null;
  trailerNo?: string | null;
  note?: string | null;
  createdAt: string;
  // computed by findAll
  totalAdvance?: number;      // إجمالي السلف المصروفة
  delayEarned?: number;       // إجمالي العطلات المكتسبة (بتسدّد السلفة)
  outstandingAdvance?: number; // المتبقي من السلفة على السائق
}

export interface DriverAdvance {
  id: string;
  driverName: string;
  date: string;
  amount: number;
  note?: string | null;
  createdAt: string;
}

export interface CreateDriverAdvanceDto {
  driverName: string;
  date: string;
  amount: number;
  treasuryId: string;
  note?: string;
}

export interface UpdateDriverDto {
  nationalId?: string;
  phone?: string;
  phone2?: string;
  vehicleNo?: string;
  trailerNo?: string;
  note?: string;
}
