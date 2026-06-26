import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { Warehouse, StockRow, WarehouseDto } from './dtos';

export const warehousesApi = {
  list: (params: ListParams = {}) => api.get<Paginated<Warehouse>>(`/warehouses${toQuery(params)}`),
  stock: (id: string) => api.get<StockRow[]>(`/warehouses/${id}/stock`),
  create: (dto: WarehouseDto) => api.post<Warehouse>('/warehouses', dto),
  update: (id: string, dto: WarehouseDto) => api.patch<Warehouse>(`/warehouses/${id}`, dto),
  remove: (id: string) => api.del<void>(`/warehouses/${id}`),
};
