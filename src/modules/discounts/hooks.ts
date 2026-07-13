'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { discountsApi } from './api';
import type { ListParams } from '@/lib/list-params';
import type { CreateDiscountDto, CreateDiscountScheduleDto } from './dtos';

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

// ── recurring schedules ──
export function useDiscountSchedules() {
  return useQuery({ queryKey: ['discounts', 'schedules'], queryFn: () => discountsApi.listSchedules() });
}

export function useCreateDiscountSchedule() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (dto: CreateDiscountScheduleDto) => discountsApi.createSchedule(dto), onSuccess: () => invalidate(qc) });
}

export function useDeleteDiscountSchedule() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => discountsApi.removeSchedule(id), onSuccess: () => invalidate(qc) });
}
