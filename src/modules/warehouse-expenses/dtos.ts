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
  warehouseId: string;
  treasuryId?: string;
  categoryId?: string;
  title: string;
  amount: number;
  dayOfMonth?: number;
  active?: boolean;
}
