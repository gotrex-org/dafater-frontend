import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { ExpenseCategory, CategoryDto } from './dtos';

export const expenseCategoriesApi = {
  list: (params: ListParams = {}) =>
    api.get<Paginated<ExpenseCategory>>(`/expense-categories${toQuery(params)}`),
  create: (dto: CategoryDto) => api.post<ExpenseCategory>('/expense-categories', dto),
  update: (id: string, dto: CategoryDto) => api.patch<ExpenseCategory>(`/expense-categories/${id}`, dto),
  remove: (id: string) => api.del<void>(`/expense-categories/${id}`),
};
