import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { Deal, CreateDealDto } from './dtos';

export const dealsApi = {
  list: (params: ListParams = {}) => api.get<Paginated<Deal>>(`/deals${toQuery(params)}`),
  getById: (uid: string) => api.get<Deal>(`/deals/${uid}`),
  nextNo: (clientId: string) => api.get<{ no: string }>(`/deals/next-no?clientId=${encodeURIComponent(clientId)}`),
  create: (dto: CreateDealDto) => api.post<Deal>('/deals', dto),
  update: (id: string, dto: CreateDealDto) => api.patch<Deal>(`/deals/${id}`, dto),
  updateCommission: (id: string, dto: { commissionAmount?: number; commissionPartyId?: string }) =>
    api.patch<void>(`/deals/${id}/commission`, dto),
  remove: (id: string) => api.del<void>(`/deals/${id}`),
};
