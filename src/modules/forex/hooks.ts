'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { forexApi } from './api';
import type { CreateAgentDto, UpdateAgentDto, EgpInDto, UsdOutDto, SettleDto } from './dtos';

const KEYS = { all: ['forex'] as const, one: (uid: string) => ['forex', uid] as const };

export function useForexAgents() {
  return useQuery({ queryKey: KEYS.all, queryFn: forexApi.list });
}

export function useForexAgent(uid: string) {
  return useQuery({ queryKey: KEYS.one(uid), queryFn: () => forexApi.findOne(uid), enabled: !!uid });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (dto: CreateAgentDto) => forexApi.create(dto), onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }) });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, dto }: { uid: string; dto: UpdateAgentDto }) => forexApi.update(uid, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (uid: string) => forexApi.remove(uid), onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }) });
}

export function useEgpIn(agentUid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: EgpInDto) => forexApi.egpIn(agentUid, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEYS.all }); qc.invalidateQueries({ queryKey: KEYS.one(agentUid) }); },
  });
}

export function useEgpInAny() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentUid, dto }: { agentUid: string; dto: EgpInDto }) => forexApi.egpIn(agentUid, dto),
    onSuccess: (_, { agentUid }) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.one(agentUid) });
    },
  });
}

export function useUsdOut(agentUid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UsdOutDto) => forexApi.usdOut(agentUid, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEYS.all }); qc.invalidateQueries({ queryKey: KEYS.one(agentUid) }); },
  });
}

export function useSettle(agentUid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: SettleDto) => forexApi.settle(agentUid, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEYS.all }); qc.invalidateQueries({ queryKey: KEYS.one(agentUid) }); },
  });
}

export function useDeleteAgentTx(agentUid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (txUid: string) => forexApi.deleteTx(txUid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEYS.all }); qc.invalidateQueries({ queryKey: KEYS.one(agentUid) }); },
  });
}
