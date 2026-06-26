import { api } from '@/lib/api';
import type { DollarAgent, DollarAgentDetail, CreateAgentDto, UpdateAgentDto, EgpInDto, UsdOutDto } from './dtos';

export const forexApi = {
  list: () => api.get<DollarAgent[]>('/forex'),
  findOne: (uid: string) => api.get<DollarAgentDetail>(`/forex/${uid}`),
  create: (dto: CreateAgentDto) => api.post<DollarAgent>('/forex', dto),
  update: (uid: string, dto: UpdateAgentDto) => api.patch<DollarAgent>(`/forex/${uid}`, dto),
  remove: (uid: string) => api.del<void>(`/forex/${uid}`),
  egpIn: (uid: string, dto: EgpInDto) => api.post<DollarAgentDetail>(`/forex/${uid}/egp-in`, dto),
  usdOut: (uid: string, dto: UsdOutDto) => api.post<DollarAgentDetail>(`/forex/${uid}/usd-out`, dto),
  deleteTx: (txUid: string) => api.del<void>(`/forex/tx/${txUid}`),
};
