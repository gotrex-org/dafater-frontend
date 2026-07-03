import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { Party, CreatePartyDto, UpdatePartyDto, LedgerStatement, PartyRole } from './dtos';

export interface PartyListParams extends ListParams {
  role?: PartyRole;
  includeHidden?: boolean;
}

export const partiesApi = {
  list: (params: PartyListParams = {}) => api.get<Paginated<Party>>(`/parties${toQuery(params)}`),
  get: (id: string) => api.get<Party>(`/parties/${id}`),
  ledger: (id: string, params: { from?: string; to?: string } = {}) => api.get<LedgerStatement>(`/parties/${id}/ledger${toQuery(params)}`),
  create: (dto: CreatePartyDto) => api.post<Party>('/parties', dto),
  update: (id: string, dto: UpdatePartyDto) => api.patch<Party>(`/parties/${id}`, dto),
  remove: (id: string) => api.del<void>(`/parties/${id}`),
  linkParty: (id: string, linkedPartyUid: string) => api.patch<Party>(`/parties/${id}/link`, { linkedPartyUid }),
  unlinkParty: (id: string) => api.del<Party>(`/parties/${id}/link`),
};
