'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/lib/list-params';
import { expenseCategoriesApi } from './api';
import type { CategoryDto } from './dtos';

export const categoryKeys = {
  all: ['expense-categories'] as const,
  list: (params: ListParams) => ['expense-categories', 'list', params] as const,
};

export function useExpenseCategories(params: ListParams = {}) {
  return useQuery({ queryKey: categoryKeys.list(params), queryFn: () => expenseCategoriesApi.list(params) });
}

export function useAllExpenseCategories() {
  return useExpenseCategories({ all: true });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CategoryDto) => expenseCategoriesApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CategoryDto }) => expenseCategoriesApi.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expenseCategoriesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}
