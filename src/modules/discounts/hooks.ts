'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { discountsApi } from './api';
import type { ListParams } from '@/lib/list-params';
import type { CreateDiscountDto } from './dtos';

export const discountKeys = {
  all: ['discounts'] as const,
  list: (params: ListParams) => ['discounts', 'list', params] as const,
};

export function useDiscounts(params: ListParams = {}) {
  return useQuery({ queryKey: discountKeys.list(params), queryFn: () => discountsApi.list(params) });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: discountKeys.all });
  qc.invalidateQueries({ queryKey: ['parties'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
}

export function useCreateDiscount() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (dto: CreateDiscountDto) => discountsApi.create(dto), onSuccess: () => invalidate(qc) });
}

export function useDeleteDiscount() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, cascade }: { id: string; cascade?: boolean }) => discountsApi.remove(id, cascade), onSuccess: () => invalidate(qc) });
}
