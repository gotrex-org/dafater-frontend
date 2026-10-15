'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearanceApi } from './api';
import type {
  AddCashClearanceDto, AddClearanceExpenseDto, ClearanceAgentDto, ClearanceQuery,
  PayClearanceAgentDto, UpdateClearanceMovementDto,
} from './dtos';

const KEY = 'clearance';

export function useClearanceAgents(archived = false) {
  return useQuery({ queryKey: [KEY, 'agents', archived], queryFn: () => clearanceApi.agents(archived) });
}

export function useClearance(q: ClearanceQuery = {}) {
  return useQuery({ queryKey: [KEY, 'list', q], queryFn: () => clearanceApi.list(q) });
}

export function useClearanceStatement(id: string | null, q: ClearanceQuery = {}) {
  return useQuery({
    queryKey: [KEY, 'statement', id, q],
    queryFn: () => clearanceApi.statement(id!, q),
    enabled: !!id,
  });
}

/** أي حركة تخليص بتمسّ كشف الحساب والخزنة والعربية والتقارير — فبنبطّل الكاش بتاعهم كلهم. */
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [KEY] });
  qc.invalidateQueries({ queryKey: ['parties'] });
  qc.invalidateQueries({ queryKey: ['treasury'] });
  qc.invalidateQueries({ queryKey: ['manifests'] });
  qc.invalidateQueries({ queryKey: ['reports'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
}

function useInvalidating<T, R = unknown>(fn: (arg: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateAll(qc) });
}

export const useCreateClearanceAgent = () => useInvalidating((dto: ClearanceAgentDto) => clearanceApi.createAgent(dto));
export const useUpdateClearanceAgent = () =>
  useInvalidating(({ id, dto }: { id: string; dto: Partial<ClearanceAgentDto> }) => clearanceApi.updateAgent(id, dto));
export const useArchiveClearanceAgent = () =>
  useInvalidating(({ id, archived }: { id: string; archived: boolean }) => clearanceApi.archiveAgent(id, archived));
export const useDeleteClearanceAgent = () => useInvalidating((id: string) => clearanceApi.deleteAgent(id));

export const useAddClearanceExpense = () => useInvalidating((dto: AddClearanceExpenseDto) => clearanceApi.addExpense(dto));
export const useAddCashClearance = () => useInvalidating((dto: AddCashClearanceDto) => clearanceApi.addCashExpense(dto));
export const usePayClearanceAgent = () => useInvalidating((dto: PayClearanceAgentDto) => clearanceApi.pay(dto));
export const useUpdateClearanceMovement = () =>
  useInvalidating(({ id, dto }: { id: string; dto: UpdateClearanceMovementDto }) => clearanceApi.update(id, dto));
export const useDeleteClearanceMovement = () => useInvalidating((id: string) => clearanceApi.remove(id));
