'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/lib/list-params';
import { treasuryApi } from './api';
import type { TreasuryDto } from './dtos';

export const treasuryKeys = {
  all: ['treasury'] as const,
  list: (params: ListParams) => ['treasury', 'list', params] as const,
  movements: (params: ListParams) => ['treasury', 'movements', params] as const,
  expenses: ['treasury', 'expenses-by-category'] as const,
};

export function useTreasury(params: ListParams = {}) {
  return useQuery({ queryKey: treasuryKeys.list(params), queryFn: () => treasuryApi.list(params) });
}

export function useAllTreasury() {
  return useTreasury({ all: true });
}

export function useTreasuryMovements(params: ListParams = {}) {
  return useQuery({ queryKey: treasuryKeys.movements(params), queryFn: () => treasuryApi.movements(params) });
}

export function useExpensesByCategory() {
  return useQuery({ queryKey: treasuryKeys.expenses, queryFn: () => treasuryApi.expensesByCategory() });
}

export function useCreateTreasury() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: TreasuryDto) => treasuryApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: treasuryKeys.all }),
  });
}

export function useUpdateTreasury() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: TreasuryDto }) => treasuryApi.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: treasuryKeys.all }),
  });
}

export function useDeleteTreasury() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => treasuryApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: treasuryKeys.all }),
  });
}
