import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { driversApi } from './api';
import type { CreateDriverAdvanceDto, UpdateDriverDto } from './dtos';

const KEY = ['drivers'];

export function useDrivers(search?: string) {
  return useQuery({
    queryKey: [...KEY, search ?? ''],
    queryFn: () => driversApi.list({ search, all: true }),
  });
}

export function useUpdateDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateDriverDto }) => driversApi.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => driversApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDriverAdvances(name: string | null) {
  return useQuery({
    queryKey: ['driver-advances', name],
    queryFn: () => driversApi.listAdvances(name as string),
    enabled: !!name,
  });
}

export function useCreateDriverAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDriverAdvanceDto) => driversApi.createAdvance(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['driver-advances'] });
      qc.invalidateQueries({ queryKey: ['treasury'] });
    },
  });
}

export function useDeleteDriverAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uid: string) => driversApi.removeAdvance(uid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['driver-advances'] });
      qc.invalidateQueries({ queryKey: ['treasury'] });
    },
  });
}
