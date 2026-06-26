'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/lib/list-params';
import { dealsApi } from './api';
import type { CreateDealDto } from './dtos';

export const dealKeys = {
  all: ['deals'] as const,
  list: (params: ListParams) => ['deals', 'list', params] as const,
  one: (uid: string) => ['deals', 'one', uid] as const,
};

export function useDeals(params: ListParams = {}) {
  return useQuery({ queryKey: dealKeys.list(params), queryFn: () => dealsApi.list(params) });
}

export function useDeal(uid: string) {
  return useQuery({ queryKey: dealKeys.one(uid), queryFn: () => dealsApi.getById(uid), enabled: !!uid });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDealDto) => dealsApi.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dealKeys.all });
      qc.invalidateQueries({ queryKey: ['parties'] });
      qc.invalidateQueries({ queryKey: ['treasury'] });
    },
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CreateDealDto }) => dealsApi.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dealKeys.all });
      qc.invalidateQueries({ queryKey: ['parties'] });
      qc.invalidateQueries({ queryKey: ['treasury'] });
    },
  });
}

export function useUpdateDealCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { commissionAmount?: number; commissionPartyId?: string } }) =>
      dealsApi.updateCommission(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dealKeys.all });
      qc.invalidateQueries({ queryKey: ['parties'] });
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dealsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dealKeys.all });
      qc.invalidateQueries({ queryKey: ['parties'] });
      qc.invalidateQueries({ queryKey: ['treasury'] });
    },
  });
}
