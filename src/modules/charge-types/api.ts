import { api } from '@/lib/api';
import type { ChargeType, ChargeTypeDto } from './dtos';

export const chargeTypesApi = {
  list: (all = false) => api.get<ChargeType[]>(`/charge-types${all ? '?all=1' : ''}`),
  create: (dto: ChargeTypeDto) => api.post<ChargeType>('/charge-types', dto),
  update: (id: string, dto: ChargeTypeDto) => api.patch<ChargeType>(`/charge-types/${id}`, dto),
  remove: (id: string) => api.del<{ ok: boolean; archived: boolean }>(`/charge-types/${id}`),
};
