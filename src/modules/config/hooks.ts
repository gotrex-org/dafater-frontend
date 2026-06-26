'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configApi } from './api';
import type { UpdateConfigDto } from './dtos';

export const configKeys = { all: ['config'] as const };

export function useConfig() {
  return useQuery({ queryKey: configKeys.all, queryFn: () => configApi.get() });
}

export function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateConfigDto) => configApi.update(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: configKeys.all }),
  });
}
