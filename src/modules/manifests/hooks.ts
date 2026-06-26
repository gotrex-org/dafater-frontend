'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/lib/list-params';
import { manifestsApi } from './api';
import type { CreateManifestDto, UpdateManifestDto } from './dtos';

export const manifestKeys = {
  all: ['manifests'] as const,
  list: (params: ListParams) => ['manifests', 'list', params] as const,
};

export function useManifests(params: ListParams = {}) {
  return useQuery({ queryKey: manifestKeys.list(params), queryFn: () => manifestsApi.list(params) });
}

export function useManifest(id: string | null) {
  return useQuery({
    queryKey: ['manifests', 'one', id],
    queryFn: () => manifestsApi.get(id as string),
    enabled: !!id,
  });
}

export function useCreateManifest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateManifestDto) => manifestsApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: manifestKeys.all }),
  });
}

export function useUpdateManifest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateManifestDto }) => manifestsApi.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: manifestKeys.all }),
  });
}

export function useDeleteManifest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => manifestsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: manifestKeys.all }),
  });
}
