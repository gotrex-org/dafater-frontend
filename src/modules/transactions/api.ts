import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { Transaction, PostEntryDto, PendingCollection, UpdateTransactionDto } from './dtos';

export const transactionsApi = {
  list: (params: ListParams = {}) => api.get<Paginated<Transaction>>(`/transactions${toQuery(params)}`),
  post: (dto: PostEntryDto) => api.post<Transaction>('/transactions', dto),
  pending: () => api.get<PendingCollection[]>('/transactions/pending'),
  resolve: (id: string, partyId: string, transferFee?: number) => api.patch<Transaction>(`/transactions/${id}/resolve`, { partyId, transferFee }),
  update: (id: string, dto: UpdateTransactionDto) => api.patch<Transaction>(`/transactions/${id}`, dto),
  remove: (id: string) => api.del<void>(`/transactions/${id}`),
};
