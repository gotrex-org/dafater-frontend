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
}

export interface UpdateDriverDto {
  nationalId?: string;
  phone?: string;
  phone2?: string;
  vehicleNo?: string;
  trailerNo?: string;
  note?: string;
}
