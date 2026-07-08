'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { partiesApi, PartyListParams } from './api';
import type { CreatePartyDto, UpdatePartyDto, PartyRole } from './dtos';

export const partyKeys = {
  all: ['parties'] as const,
  list: (params: PartyListParams) => ['parties', 'list', params] as const,
  ledger: (id: string) => ['parties', 'ledger', id] as const,
};

export function useParties(params: PartyListParams = {}) {
  return useQuery({ queryKey: partyKeys.list(params), queryFn: () => partiesApi.list(params) });
}

export function useAllParties(role?: PartyRole) {
  return useParties({ role, all: true });
}

export function useParty(id: string | null) {
  return useQuery({
    queryKey: partyKeys.list({ one: id }),
    queryFn: () => partiesApi.get(id as string),
    enabled: !!id,
  });
}

export function usePartyLedger(id: string | undefined, params: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: [...partyKeys.ledger(id || ''), params],
    queryFn: () => partiesApi.ledger(id as string, params),
    enabled: !!id,
  });
}

export function useCreateParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePartyDto) => partiesApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: partyKeys.all }),
  });
}

export function useUpdateParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdatePartyDto }) => partiesApi.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: partyKeys.all }),
  });
}

export function useDeleteParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cascade }: { id: string; cascade?: boolean }) => partiesApi.remove(id, cascade),
    onSuccess: () => qc.invalidateQueries({ queryKey: partyKeys.all }),
  });
}

export function useLinkParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, linkedPartyUid }: { id: string; linkedPartyUid: string }) =>
      partiesApi.linkParty(id, linkedPartyUid),
    onSuccess: () => qc.invalidateQueries({ queryKey: partyKeys.all }),
  });
}

export function useUnlinkParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => partiesApi.unlinkParty(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: partyKeys.all }),
  });
}
