'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/lib/list-params';
import { productsApi } from './api';
import type { CreateProductDto, UpdateProductDto } from './dtos';

export const productKeys = {
  all: ['products'] as const,
  list: (params: ListParams) => ['products', 'list', params] as const,
};

export function useProducts(params: ListParams = {}) {
  return useQuery({ queryKey: productKeys.list(params), queryFn: () => productsApi.list(params) });
}

/** full list for dropdowns */
export function useAllProducts() {
  return useProducts({ all: true });
}

/** No-auth product list for the public (no-login) order form's item suggestions. */
export function usePublicProducts() {
  return useQuery({ queryKey: ['products', 'public-catalog'], queryFn: () => productsApi.publicCatalog() });
}

export function useLastPrices(kind: 'SALE' | 'PURCHASE') {
  return useQuery({ queryKey: ['products', 'last-prices', kind], queryFn: () => productsApi.lastPrices(kind) });
}

export function useProductMovements(id: string | null) {
  return useQuery({
    queryKey: ['products', 'movements', id],
    queryFn: () => productsApi.movements(id as string),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProductDto) => productsApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateProductDto }) => productsApi.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cascade }: { id: string; cascade?: boolean }) => productsApi.remove(id, cascade),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}
