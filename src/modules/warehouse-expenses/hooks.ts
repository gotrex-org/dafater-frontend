'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { warehouseExpensesApi } from './api';
import type { CreateWarehouseScheduleDto } from './dtos';

const KEY = ['warehouse-expenses', 'schedules'] as const;

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['warehouse-expenses'] });
  qc.invalidateQueries({ queryKey: ['treasury'] });
  qc.invalidateQueries({ queryKey: ['reports'] });
  qc.invalidateQueries({ queryKey: ['transactions'] });
}

export function useWarehouseSchedules(enabled = true) {
  return useQuery({ queryKey: KEY, queryFn: () => warehouseExpensesApi.listSchedules(), enabled });
}

export function useCreateWarehouseSchedule() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (dto: CreateWarehouseScheduleDto) => warehouseExpensesApi.createSchedule(dto), onSuccess: () => invalidate(qc) });
}

export function useDeleteWarehouseSchedule() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => warehouseExpensesApi.removeSchedule(id), onSuccess: () => invalidate(qc) });
}
