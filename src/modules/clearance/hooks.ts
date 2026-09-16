'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearanceApi } from './api';
import type { AddClearanceExpenseDto, ClearanceQuery, PayClearanceAgentDto } from './dtos';

const KEY = 'clearance';

export function useClearanceAgents() {
  return useQuery({ queryKey: [KEY, 'agents'], queryFn: () => clearanceApi.agents() });
}

export function useClearance(q: ClearanceQuery = {}) {
  return useQuery({ queryKey: [KEY, 'list', q], queryFn: () => clearanceApi.list(q) });
}

/** أي حركة تخليص بتمسّ كشف الحساب والخزنة والعربية — فبنبطّل الكاش بتاعهم كلهم. */
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [KEY] });
  qc.invalidateQueries({ queryKey: ['parties'] });
  qc.invalidateQueries({ queryKey: ['treasury'] });
  qc.invalidateQueries({ queryKey: ['manifests'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
}

export function useAddClearanceExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: AddClearanceExpenseDto) => clearanceApi.addExpense(dto),
    onSuccess: () => invalidateAll(qc),
  });
}

export function usePayClearanceAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: PayClearanceAgentDto) => clearanceApi.pay(dto),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteClearanceMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clearanceApi.remove(id),
    onSuccess: () => invalidateAll(qc),
  });
}
