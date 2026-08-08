import { api, http } from '@/lib/api';
import type { Driver, DriverAdvance, CreateDriverAdvanceDto, UpdateDriverDto } from './dtos';

export const driversApi = {
  list: (params?: { search?: string; all?: boolean }) =>
    http.get<{ data: Driver[]; meta: unknown }>('/drivers', { params }).then((r) => r.data),
  get: (id: string) => http.get<Driver>(`/drivers/${id}`).then((r) => r.data),
  update: (id: string, dto: UpdateDriverDto) => api.patch<Driver>(`/drivers/${id}`, dto),
  remove: (id: string) => api.del<void>(`/drivers/${id}`),

  createAdvance: (dto: CreateDriverAdvanceDto) => api.post<DriverAdvance>('/drivers/advances', dto),
  listAdvances: (name: string) => api.get<DriverAdvance[]>(`/drivers/advances/${encodeURIComponent(name)}`),
  removeAdvance: (uid: string) => api.del<void>(`/drivers/advances/${uid}`),
};
