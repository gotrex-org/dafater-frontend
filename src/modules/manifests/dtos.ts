export interface ManifestItem {
  id?: string;
  name: string;
  qty: number;
}

/**
 * نوع خروج البضاعة — هو اللي بيحدد السلسلة بتكمل ولا لأ:
 *   OURS          خروج من المخزن → ليها كشف سائق وتخليص وجمارك
 *   CLIENT_OFFICE مكتب شحن → اسم المكتب بس (shippingOffice)
 * (قيم الـ enum في الداتابيز سايبينها زي ما هي — التسمية اللي بتتغيّر.)
 */
export type VehicleSource = 'OURS' | 'CLIENT_OFFICE';

export const VEHICLE_SOURCE_LABEL: Record<VehicleSource, string> = {
  OURS: 'خروج من المخزن',
  CLIENT_OFFICE: 'مكتب شحن',
};

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
  vehicleSource: VehicleSource;
  /** اسم مكتب الشحن — لما تكون العربية من عند العميل */
  shippingOffice?: string | null;
  note?: string | null;
  items: ManifestItem[];
  driverTrips?: { uid?: string; arrivalDate?: string | null; driverName?: string | null }[];
  /** إجمالي الجمارك على الكشف + مخلّصه — بييجي من GET /manifests/:id */
  clearance?: { total: number; agent?: { uid: string; name: string } | null } | null;
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
  vehicleSource?: VehicleSource;
  shippingOffice?: string;
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
  vehicleSource?: VehicleSource;
  shippingOffice?: string;
  note?: string;
  items?: ManifestItem[];
}

/** سطر إيراد (بند شحن على فاتورة) في تكاليف الشحن للعربية */
export interface VehicleRevenueLine {
  id: string; name: string; qty: number; price: number; total: number;
  note: string | null; invoiceNo: string | null;
}

/** قسم «تكاليف الشحن» في كشف العربية — GET /manifests/:id/shipping */
export interface VehicleShipping {
  id: string;
  no: string;
  date: string;
  clientName: string;
  vehicleNo?: string | null;
  trailerNo?: string | null;
  vehicleLabel?: string | null;
  driverName?: string | null;
  vehicleSource: VehicleSource;
  invoice: { id: string; no: string; kind: 'SALE' | 'PURCHASE'; currency: 'EGP' | 'USD' } | null;
  revenue: VehicleRevenueLine[];
  revenueTotal: number;
  /** بنود على فاتورة العربية غير مربوطة بعربية (الفاتورة عليها أكثر من عربية) */
  unassignedCharges: VehicleRevenueLine[];
  rent: { total: number; lines: { id: string; driverName: string; amount: number; departureDate: string; arrivalDate: string | null }[] };
  customs: { total: number; lines: { id: string; date: string; amount: number; office: { id: string; name: string } | null; note: string | null }[] };
  vehicleExpenses: {
    total: number;
    lines: { id: string; date: string; category: string | null; amount: number; note: string | null; treasury: string | null }[];
    byCategory: { name: string; total: number }[];
  };
  otherExpenses: { total: number; lines: { id: string; date: string; category: string | null; amount: number; note: string | null; treasury: string | null }[] };
  costs: number;
  profit: number;
}
