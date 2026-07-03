'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/lib/list-params';
import { auditApi } from './api';

export function useAudit(params: ListParams & { user?: string } = {}) {
  return useQuery({
    queryKey: ['audit', params],
    queryFn: () => auditApi.list(params),
  });
}

export function useTrash(params: ListParams = {}) {
  return useQuery({
    queryKey: ['audit-trash', params],
    queryFn: () => auditApi.trash(params),
  });
}

export function useUndoAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => auditApi.undo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit'] });
      qc.invalidateQueries({ queryKey: ['audit-trash'] });
    },
  });
}
