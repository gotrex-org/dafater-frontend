import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { ReturnDoc, CreateReturnDto } from './dtos';
import type { InvoiceKind } from '../invoices/dtos';

export interface ReturnListParams extends ListParams {
  kind?: InvoiceKind;
}

export const returnsApi = {
  list: (params: ReturnListParams = {}) => api.get<Paginated<ReturnDoc>>(`/returns${toQuery(params)}`),
  get: (id: string) => api.get<ReturnDoc>(`/returns/${id}`),
  nextNo: (partyId: string) => api.get<{ no: string }>(`/returns/next-no?partyId=${encodeURIComponent(partyId)}`),
  create: (dto: CreateReturnDto) => api.post<ReturnDoc>('/returns', dto),
  remove: (id: string, cascade?: boolean) => api.del<void>(`/returns/${id}${cascade ? '?cascade=true' : ''}`),
};
