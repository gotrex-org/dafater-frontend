import { api } from '@/lib/api';
import { toQuery, type ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { AuditLog } from './dtos';

export const auditApi = {
  list: (params: ListParams & { user?: string } = {}) => {
    const { user, ...rest } = params;
    const q = toQuery(rest) + (user ? `&user=${encodeURIComponent(user)}` : '');
    return api.get<Paginated<AuditLog>>(`/audit${q}`);
  },
  trash: (params: ListParams = {}) =>
    api.get<Paginated<AuditLog>>(`/audit/trash${toQuery(params)}`),
  undo: (id: string) => api.post<{ ok: boolean }>(`/audit/${id}/undo`, {}),
};
