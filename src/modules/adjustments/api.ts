import { api } from '@/lib/api';
import type { Adjustment, CreateAdjustmentDto } from './dtos';
import type { Paginated } from '@/lib/types';

export const adjustmentsApi = {
  list: (warehouseId?: string) =>
    api.get<Paginated<Adjustment>>(`/adjustments${warehouseId ? `?warehouseId=${warehouseId}&all=true` : '?all=true'}`),
  create: (dto: CreateAdjustmentDto) => api.post<Adjustment>('/adjustments', dto),
  remove: (id: string) => api.del<void>(`/adjustments/${id}`),
};
