import { api } from '@/lib/api';
import type { WarehouseSchedule, CreateWarehouseScheduleDto, WarehouseDue } from './dtos';

export const warehouseExpensesApi = {
  listSchedules: () => api.get<WarehouseSchedule[]>('/warehouse-expenses/schedules'),
  createSchedule: (dto: CreateWarehouseScheduleDto) => api.post<WarehouseSchedule>('/warehouse-expenses/schedules', dto),
  removeSchedule: (id: string) => api.del<void>(`/warehouse-expenses/schedules/${id}`),
  listDues: () => api.get<WarehouseDue[]>('/warehouse-expenses/dues'),
  dueCount: () => api.get<{ count: number }>('/warehouse-expenses/dues/count'),
  payDue: (id: string, treasuryId: string) => api.post<WarehouseDue>(`/warehouse-expenses/dues/${id}/pay`, { treasuryId }),
};
