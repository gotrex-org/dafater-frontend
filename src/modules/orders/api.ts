import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { Order, CreateOrderDto, UpdateOrderDto } from './dtos';

export const ordersApi = {
  list: (params: ListParams = {}) => api.get<Paginated<Order>>(`/orders${toQuery(params)}`),
  create: (dto: CreateOrderDto) => api.post<Order>('/orders', dto),
  markDone: (id: string) => api.patch<Order>(`/orders/${id}/done`),
  receive: (id: string, items: { id: string; received: number }[]) =>
    api.patch<Order>(`/orders/${id}/receive`, { items }),
  update: (id: string, dto: UpdateOrderDto) => api.patch<Order>(`/orders/${id}`, dto),
  remove: (id: string) => api.del<void>(`/orders/${id}`),
};
