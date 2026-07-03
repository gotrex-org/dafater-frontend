import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { driversApi } from './api';
import type { UpdateDriverDto } from './dtos';

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
