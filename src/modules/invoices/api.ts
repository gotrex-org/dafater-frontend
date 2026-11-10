import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type {
  Invoice, CreateInvoiceDto, UpdateInvoiceDto, InvoiceKind, InvoiceSheet, ManifestTabs,
  InvoiceEditRequest, InvoiceEditDetail,
} from './dtos';

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
  // غير المالك: التعديل بيرجع { pending: true } ويستنى موافقة المالك
  update: (id: string, dto: UpdateInvoiceDto) => api.patch<Invoice | { pending: true }>(`/invoices/${id}`, dto),
  editRequests: () => api.get<InvoiceEditRequest[]>('/invoices/edit-requests'),
  editRequest: (uid: string) => api.get<InvoiceEditDetail>(`/invoices/edit-requests/${uid}`),
  approveEdit: (uid: string) => api.post<Invoice>(`/invoices/edit-requests/${uid}/approve`, {}),
  rejectEdit: (uid: string) => api.post<void>(`/invoices/edit-requests/${uid}/reject`, {}),
  updateCommission: (id: string, dto: { commissionAmount?: number; commissionPartyId?: string }) =>
    api.patch<void>(`/invoices/${id}/commission`, dto),
  remove: (id: string, cascade?: boolean) => api.del<void>(`/invoices/${id}${cascade ? '?cascade=true' : ''}`),
};
