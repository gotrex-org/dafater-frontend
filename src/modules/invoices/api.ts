import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { Invoice, CreateInvoiceDto, UpdateInvoiceDto, InvoiceKind } from './dtos';

export interface InvoiceListParams extends ListParams {
  kind?: InvoiceKind;
}

export const invoicesApi = {
  list: (params: InvoiceListParams = {}) => api.get<Paginated<Invoice>>(`/invoices${toQuery(params)}`),
  get: (id: string) => api.get<Invoice>(`/invoices/${id}`),
  nextNo: (partyId: string) => api.get<{ no: string }>(`/invoices/next-no?partyId=${encodeURIComponent(partyId)}`),
  create: (dto: CreateInvoiceDto) => api.post<Invoice>('/invoices', dto),
  update: (id: string, dto: UpdateInvoiceDto) => api.patch<Invoice>(`/invoices/${id}`, dto),
  updateCommission: (id: string, dto: { commissionAmount?: number; commissionPartyId?: string }) =>
    api.patch<void>(`/invoices/${id}/commission`, dto),
  remove: (id: string) => api.del<void>(`/invoices/${id}`),
};
