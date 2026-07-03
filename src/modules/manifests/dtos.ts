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
  trailerNo?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverNID?: string | null;
  clearingAgent?: string | null;
  note?: string | null;
  items: ManifestItem[];
  driverTrips?: { arrivalDate?: string | null }[];
}

export interface CreateManifestDto {
  no?: string;
  date: string;
  clientName: string;
  vehicleNo?: string;
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
  vehicleNo?: string;
  trailerNo?: string;
  driverName?: string;
  driverPhone?: string;
  driverNID?: string;
  clearingAgent?: string;
  note?: string;
  items?: ManifestItem[];
}
