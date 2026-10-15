import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { Manifest, CreateManifestDto, UpdateManifestDto, VehicleShipping } from './dtos';

export const manifestsApi = {
  list: (params: ListParams = {}) => api.get<Paginated<Manifest>>(`/manifests${toQuery(params)}`),
  get: (id: string) => api.get<Manifest>(`/manifests/${id}`),
  nextNo: (clientName: string) => api.get<{ no: string }>(`/manifests/next-no?clientName=${encodeURIComponent(clientName)}`),
  create: (dto: CreateManifestDto) => api.post<Manifest>('/manifests', dto),
  update: (id: string, dto: UpdateManifestDto) => api.patch<Manifest>(`/manifests/${id}`, dto),
  remove: (id: string) => api.del<void>(`/manifests/${id}`),
  /** تكاليف الشحن وربح العربية */
  shipping: (id: string) => api.get<VehicleShipping>(`/manifests/${id}/shipping`),
  /** ربط/فك بند شحن من فاتورة العربية بالعربية */
  assignCharge: (id: string, chargeId: string, assign: boolean) =>
    api.patch<{ ok: boolean }>(`/manifests/${id}/charges/${chargeId}`, { assign }),
};
