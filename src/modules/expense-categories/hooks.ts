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
