import { api } from '@/lib/api';
import type { WarehouseSchedule, CreateWarehouseScheduleDto } from './dtos';

export const warehouseExpensesApi = {
  listSchedules: () => api.get<WarehouseSchedule[]>('/warehouse-expenses/schedules'),
  createSchedule: (dto: CreateWarehouseScheduleDto) => api.post<WarehouseSchedule>('/warehouse-expenses/schedules', dto),
  removeSchedule: (id: string) => api.del<void>(`/warehouse-expenses/schedules/${id}`),
};
