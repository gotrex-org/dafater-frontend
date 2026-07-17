export interface WarehouseSchedule {
  id: string;
  title: string;
  amount: number;
  dayOfMonth: number;
  active: boolean;
  lastApplied?: string | null;
  warehouse?: { id: string; name: string } | null;
  treasury?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  createdAt: string;
}

export interface CreateWarehouseScheduleDto {
  warehouseId?: string;
  categoryId?: string;
  title: string;
  amount: number;
  dayOfMonth?: number;
  active?: boolean;
}

export interface WarehouseDue {
  id: string;
  period: string;      // "YYYY-MM"
  title: string;
  amount: number;
  paid: boolean;
  schedule?: { warehouse?: { name: string } | null; category?: { name: string } | null } | null;
}
