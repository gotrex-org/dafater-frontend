'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/lib/list-params';
import { warehousesApi } from './api';
import type { WarehouseDto } from './dtos';

export const warehouseKeys = {
  all: ['warehouses'] as const,
  list: (params: ListParams) => ['warehouses', 'list', params] as const,
  stock: (id: string) => ['warehouses', 'stock', id] as const,
};

export function useWarehouses(params: ListParams = {}) {
  return useQuery({ queryKey: warehouseKeys.list(params), queryFn: () => warehousesApi.list(params) });
}

export function useAllWarehouses() {
  return useWarehouses({ all: true });
}

export function useWarehouseStock(id: string | undefined) {
  return useQuery({
    queryKey: warehouseKeys.stock(id || ''),
    queryFn: () => warehousesApi.stock(id as string),
    enabled: !!id,
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: WarehouseDto) => warehousesApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: warehouseKeys.all }),
  });
}
