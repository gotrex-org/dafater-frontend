'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loansApi } from './api';
import type { CreateLoanDto, ReturnLoanDto } from './dtos';

export function useLoans(params?: { warehouseId?: string; status?: string }) {
  return useQuery({
    queryKey: ['loans', params?.warehouseId, params?.status],
    queryFn: () => loansApi.list(params),
  });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateLoanDto) => loansApi.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] });
      qc.invalidateQueries({ queryKey: ['warehouses', 'stock'] });
    },
  });
}

export function useReturnLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: ReturnLoanDto }) => loansApi.return(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] });
      qc.invalidateQueries({ queryKey: ['warehouses', 'stock'] });
    },
  });
}

export function useDeleteLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => loansApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] });
      qc.invalidateQueries({ queryKey: ['warehouses', 'stock'] });
    },
  });
}
