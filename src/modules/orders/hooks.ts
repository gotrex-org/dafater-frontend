'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/lib/list-params';
import { ordersApi } from './api';
import type { CreateOrderDto, UpdateOrderDto } from './dtos';

export const orderKeys = {
  all: ['orders'] as const,
  list: (params: ListParams) => ['orders', 'list', params] as const,
};

export function useOrders(params: ListParams = {}) {
  return useQuery({ queryKey: orderKeys.list(params), queryFn: () => ordersApi.list(params) });
}

export function useCreateOrder() {
  return useMutation({ mutationFn: (dto: CreateOrderDto) => ordersApi.create(dto) });
}

export function useMarkOrderDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersApi.markDone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  });
}

export function useReceiveOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: { id: string; received: number }[] }) =>
      ordersApi.receive(id, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateOrderDto }) => ordersApi.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  });
}
