import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { TreasuryAccount, TreasuryMovement, ExpenseByCategory, TreasuryDto } from './dtos';

export const treasuryApi = {
  list: (params: ListParams = {}) => api.get<Paginated<TreasuryAccount>>(`/treasury${toQuery(params)}`),
  movements: (params: ListParams = {}) =>
    api.get<Paginated<TreasuryMovement>>(`/treasury/movements${toQuery(params)}`),
  expensesByCategory: () => api.get<ExpenseByCategory[]>('/treasury/expenses-by-category'),
  create: (dto: TreasuryDto) => api.post<TreasuryAccount>('/treasury', dto),
  update: (id: string, dto: TreasuryDto) => api.patch<TreasuryAccount>(`/treasury/${id}`, dto),
  remove: (id: string) => api.del<void>(`/treasury/${id}`),
};
