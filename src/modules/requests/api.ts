import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { ClientRequest, CreateRequestDto, ReceiveItem } from './dtos';

export const requestsApi = {
  list: (params: ListParams = {}) => api.get<Paginated<ClientRequest>>(`/requests${toQuery(params)}`),
  create: (dto: CreateRequestDto) => api.post<ClientRequest>('/requests', dto),
  markDone: (id: string) => api.patch<ClientRequest>(`/requests/${id}/done`),
  receive: (id: string, items: ReceiveItem[]) => api.patch<ClientRequest>(`/requests/${id}/receive`, { items }),
  remove: (id: string) => api.del<void>(`/requests/${id}`),
};
