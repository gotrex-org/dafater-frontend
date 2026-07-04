import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { Product, CreateProductDto, UpdateProductDto, ProductMovement } from './dtos';

export const productsApi = {
  list: (params: ListParams = {}) => api.get<Paginated<Product>>(`/products${toQuery(params)}`),
  // No JWT required — used by the public (no-login) order form for item suggestions.
  publicCatalog: () => api.get<Product[]>('/products/public-catalog'),
  movements: (id: string) => api.get<ProductMovement[]>(`/products/${id}/movements`),
  create: (dto: CreateProductDto) => api.post<Product>('/products', dto),
  update: (id: string, dto: UpdateProductDto) => api.patch<Product>(`/products/${id}`, dto),
  remove: (id: string) => api.del<void>(`/products/${id}`),
};
