import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { Discount, CreateDiscountDto } from './dtos';

export const discountsApi = {
  list: (params: ListParams = {}) => api.get<Paginated<Discount>>(`/discounts${toQuery(params)}`),
  create: (dto: CreateDiscountDto) => api.post<Discount>('/discounts', dto),
  remove: (id: string, cascade?: boolean) => api.del<void>(`/discounts/${id}${cascade ? '?cascade=true' : ''}`),
};
