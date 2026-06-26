'use client';

import { useQuery } from '@tanstack/react-query';
import type { ListParams } from '@/lib/list-params';
import { auditApi } from './api';

export function useAudit(params: ListParams & { user?: string } = {}) {
  return useQuery({
    queryKey: ['audit', params],
    queryFn: () => auditApi.list(params),
  });
}
