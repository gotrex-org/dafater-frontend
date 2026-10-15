'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chargeTypesApi } from './api';
import type { ChargeTypeDto } from './dtos';

const KEY = ['charge-types'] as const;

export function useChargeTypes(all = false) {
  return useQuery({ queryKey: [...KEY, all], queryFn: () => chargeTypesApi.list(all) });
}

export function useCreateChargeType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: ChargeTypeDto) => chargeTypesApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateChargeType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: ChargeTypeDto }) => chargeTypesApi.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteChargeType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => chargeTypesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
