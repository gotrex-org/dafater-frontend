'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { returnsApi, ReturnListParams } from './api';
import type { CreateReturnDto } from './dtos';

export const returnKeys = {
  all: ['returns'] as const,
  list: (params: ReturnListParams) => ['returns', 'list', params] as const,
};

export function useReturns(params: ReturnListParams = {}) {
  return useQuery({ queryKey: returnKeys.list(params), queryFn: () => returnsApi.list(params) });
}

// Balances, treasury and stock are all derived from a return's movements.
function invalidateDerived(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: returnKeys.all });
  qc.invalidateQueries({ queryKey: ['parties'] });
  qc.invalidateQueries({ queryKey: ['treasury'] });
  qc.invalidateQueries({ queryKey: ['warehouses'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
}

export function useCreateReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateReturnDto) => returnsApi.create(dto),
    onSuccess: () => invalidateDerived(qc),
  });
}

export function useDeleteReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cascade }: { id: string; cascade?: boolean }) => returnsApi.remove(id, cascade),
    onSuccess: () => invalidateDerived(qc),
  });
}
