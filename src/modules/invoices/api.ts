import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { Invoice, CreateInvoiceDto, UpdateInvoiceDto, InvoiceKind, InvoiceSheet, ManifestTabs } from './dtos';

export interface InvoiceListParams extends ListParams {
  kind?: InvoiceKind;
  /** true = هات المؤرشفة كمان (شاشة الأرشيف). الافتراضي بيستبعدها. */
  includeHidden?: boolean;
}

export const invoicesApi = {
  list: (params: InvoiceListParams = {}) => api.get<Paginated<Invoice>>(`/invoices${toQuery(params)}`),
  get: (id: string) => api.get<Invoice>(`/invoices/${id}`),
  sheet: (id: string) => api.get<InvoiceSheet>(`/invoices/${id}/sheet`),
  manifestTabs: (id: string) => api.get<ManifestTabs>(`/invoices/${id}/manifest-tabs`),
  setArchived: (id: string, archived: boolean) => api.patch<void>(`/invoices/${id}/archived`, { archived }),
  setManifestTabClosed: (uid: string, closed: boolean) =>
    api.patch<void>(`/invoices/manifest-tabs/${uid}/closed`, { closed }),
  nextNo: (partyId: string) => api.get<{ no: string }>(`/invoices/next-no?partyId=${encodeURIComponent(partyId)}`),
  create: (dto: CreateInvoiceDto) => api.post<Invoice>('/invoices', dto),
  update: (id: string, dto: UpdateInvoiceDto) => api.patch<Invoice>(`/invoices/${id}`, dto),
  updateCommission: (id: string, dto: { commissionAmount?: number; commissionPartyId?: string }) =>
    api.patch<void>(`/invoices/${id}/commission`, dto),
  remove: (id: string, cascade?: boolean) => api.del<void>(`/invoices/${id}${cascade ? '?cascade=true' : ''}`),
};
