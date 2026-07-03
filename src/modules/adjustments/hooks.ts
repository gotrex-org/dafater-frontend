import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adjustmentsApi } from './api';
import { warehouseKeys } from '../warehouses/hooks';
import type { CreateAdjustmentDto } from './dtos';

const KEY = (whId?: string) => ['adjustments', whId ?? ''];

export function useAdjustments(warehouseId?: string) {
  return useQuery({
    queryKey: KEY(warehouseId),
    queryFn: () => adjustmentsApi.list(warehouseId),
    enabled: !!warehouseId,
  });
}

export function useCreateAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAdjustmentDto) => adjustmentsApi.create(dto),
    onSuccess: (_, dto) => {
      qc.invalidateQueries({ queryKey: KEY(dto.warehouseId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.stock(dto.warehouseId) });
    },
  });
}

export function useDeleteAdjustment(warehouseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adjustmentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(warehouseId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.stock(warehouseId) });
    },
  });
}
