'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/lib/list-params';
import { transactionsApi } from './api';
import type { PostEntryDto, UpdateTransactionDto } from './dtos';

export const transactionKeys = {
  all: ['transactions'] as const,
  list: (params: ListParams) => ['transactions', 'list', params] as const,
};

export function useTransactions(params: ListParams = {}) {
  return useQuery({ queryKey: transactionKeys.list(params), queryFn: () => transactionsApi.list(params) });
}

function invalidateLedgers(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: transactionKeys.all });
  qc.invalidateQueries({ queryKey: ['parties'] });
  qc.invalidateQueries({ queryKey: ['treasury'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
  qc.invalidateQueries({ queryKey: ['driver-trips'] });
}

export function usePostEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: PostEntryDto) => transactionsApi.post(dto),
    onSuccess: () => invalidateLedgers(qc),
  });
}

export function usePendingCollections() {
  return useQuery({ queryKey: ['transactions', 'pending'], queryFn: () => transactionsApi.pending() });
}

export function useResolveCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, partyId, transferFee }: { id: string; partyId: string; transferFee?: number }) => transactionsApi.resolve(id, partyId, transferFee),
    onSuccess: () => invalidateLedgers(qc),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTransactionDto }) => transactionsApi.update(id, dto),
    onSuccess: () => invalidateLedgers(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transactionsApi.remove(id),
    onSuccess: () => invalidateLedgers(qc),
  });
}
