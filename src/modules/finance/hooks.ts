'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { financeApi } from './api';
import type { CreateOwnerEntryDto } from './dtos';

export const financeKeys = { all: ['finance'] as const };

export function useFinance({ from, to }: { from?: string; to?: string }) {
  return useQuery({ queryKey: ['finance', from, to], queryFn: () => financeApi.list(from, to) });
}

function useFinanceMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }) });
}

export const useCreateOwnerEntry = () => useFinanceMutation((dto: CreateOwnerEntryDto) => financeApi.create(dto));
export const useUpdateOwnerEntry = () => useFinanceMutation(({ id, dto }: { id: string; dto: Partial<CreateOwnerEntryDto> }) => financeApi.update(id, dto));
export const useDeleteOwnerEntry = () => useFinanceMutation((id: string) => financeApi.remove(id));
