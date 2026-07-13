import { api } from '@/lib/api';
import type { FinanceData, OwnerEntry, CreateOwnerEntryDto } from './dtos';

const range = (from?: string, to?: string) => {
  const p = new URLSearchParams();
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const financeApi = {
  list: (from?: string, to?: string) => api.get<FinanceData>(`/finance${range(from, to)}`),
  create: (dto: CreateOwnerEntryDto) => api.post<OwnerEntry>('/finance', dto),
  update: (id: string, dto: Partial<CreateOwnerEntryDto>) => api.patch<OwnerEntry>(`/finance/${id}`, dto),
  remove: (id: string) => api.del<void>(`/finance/${id}`),
};
