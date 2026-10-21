import { api } from '@/lib/api';
import { toQuery, type ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { AuditLog } from './dtos';

export const auditApi = {
  list: (params: ListParams & { user?: string; action?: string; review?: string } = {}) =>
    api.get<Paginated<AuditLog>>(`/audit${toQuery(params)}`),
  trash: (params: ListParams = {}) =>
    api.get<Paginated<AuditLog>>(`/audit/trash${toQuery(params)}`),
  undo: (id: string) => api.post<{ ok: boolean }>(`/audit/${id}/undo`, {}),
  approve: (id: string) => api.post<{ ok: boolean }>(`/audit/${id}/approve`, {}),
  reject: (id: string) => api.post<{ ok: boolean; reverted: boolean }>(`/audit/${id}/reject`, {}),
};
