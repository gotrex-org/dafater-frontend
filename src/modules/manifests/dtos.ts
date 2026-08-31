export interface ManifestItem {
  id?: string;
  name: string;
  qty: number;
}

export interface Manifest {
  id: string;
  no: string;
  date: string;
  clientName: string;
  vehicleNo?: string | null;
  /** مسمّى العربية (عربية الزيتون / عربية ديدي) */
  vehicleLabel?: string | null;
  trailerNo?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverNID?: string | null;
  clearingAgent?: string | null;
  note?: string | null;
  items: ManifestItem[];
  driverTrips?: { arrivalDate?: string | null }[];
  /** الفاتورة المرتبطة — وجودها هو اللي بيخلّي العربية تظهر كتاب جوّه الفاتورة */
  invoice?: { id: string; no: string; date: string; kind: 'SALE' | 'PURCHASE' } | null;
}

export interface CreateManifestDto {
  no?: string;
  /** ربط العربية بفاتورة — بتخلّيها تظهر كتاب جوّه الفاتورة (ManifestTabs) */
  invoiceId?: string;
  date: string;
  clientName: string;
  vehicleNo?: string;
  vehicleLabel?: string;
  trailerNo?: string;
  driverName?: string;
  driverPhone?: string;
  driverNID?: string;
  clearingAgent?: string;
  note?: string;
  items: ManifestItem[];
}

export interface UpdateManifestDto {
  date?: string;
  clientName?: string;
  /** ربط بفاتورة — سلسلة فاضية معناها فك الربط */
  invoiceId?: string;
  vehicleNo?: string;
  vehicleLabel?: string;
  trailerNo?: string;
  driverName?: string;
  driverPhone?: string;
  driverNID?: string;
  clearingAgent?: string;
  note?: string;
  items?: ManifestItem[];
}
