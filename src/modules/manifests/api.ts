import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { Manifest, CreateManifestDto, UpdateManifestDto } from './dtos';

export const manifestsApi = {
  list: (params: ListParams = {}) => api.get<Paginated<Manifest>>(`/manifests${toQuery(params)}`),
  get: (id: string) => api.get<Manifest>(`/manifests/${id}`),
  nextNo: (clientName: string) => api.get<{ no: string }>(`/manifests/next-no?clientName=${encodeURIComponent(clientName)}`),
  create: (dto: CreateManifestDto) => api.post<Manifest>('/manifests', dto),
  update: (id: string, dto: UpdateManifestDto) => api.patch<Manifest>(`/manifests/${id}`, dto),
  remove: (id: string) => api.del<void>(`/manifests/${id}`),
};
