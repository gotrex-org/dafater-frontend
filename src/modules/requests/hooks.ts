'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/lib/list-params';
import { requestsApi } from './api';
import type { CreateRequestDto } from './dtos';

export const requestKeys = {
  all: ['requests'] as const,
  list: (params: ListParams) => ['requests', 'list', params] as const,
};

export function useRequests(params: ListParams = {}) {
  return useQuery({ queryKey: requestKeys.list(params), queryFn: () => requestsApi.list(params) });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateRequestDto) => requestsApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: requestKeys.all }),
  });
}

export function useMarkRequestDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requestsApi.markDone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: requestKeys.all }),
  });
}

export function useReceiveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: { id: string; received: number }[] }) =>
      requestsApi.receive(id, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: requestKeys.all }),
  });
}
