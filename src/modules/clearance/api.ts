import { api } from '@/lib/api';
import type {
  AddCashClearanceDto, AddClearanceExpenseDto, ClearanceAgent, ClearanceAgentDto, ClearanceList,
  ClearanceQuery, ClearanceStatement, PayClearanceAgentDto, UpdateClearanceMovementDto,
} from './dtos';

const qs = (q: ClearanceQuery) => {
  const p = new URLSearchParams();
  if (q.agentId) p.set('agentId', q.agentId);
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  if (q.archived) p.set('archived', '1');
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const clearanceApi = {
  agents: (archived = false) => api.get<ClearanceAgent[]>(`/clearance/agents${archived ? '?archived=1' : ''}`),
  createAgent: (dto: ClearanceAgentDto) => api.post<ClearanceAgent>('/clearance/agents', dto),
  updateAgent: (id: string, dto: Partial<ClearanceAgentDto>) => api.patch<ClearanceAgent>(`/clearance/agents/${id}`, dto),
  archiveAgent: (id: string, archived: boolean) => api.patch<ClearanceAgent>(`/clearance/agents/${id}/archive`, { archived }),
  deleteAgent: (id: string) => api.del<{ ok: boolean }>(`/clearance/agents/${id}`),
  statement: (id: string, q: ClearanceQuery = {}) => api.get<ClearanceStatement>(`/clearance/agents/${id}/statement${qs(q)}`),
  list: (q: ClearanceQuery = {}) => api.get<ClearanceList>(`/clearance${qs(q)}`),
  addExpense: (dto: AddClearanceExpenseDto) => api.post('/clearance/expense', dto),
  addCashExpense: (dto: AddCashClearanceDto) => api.post('/clearance/cash-expense', dto),
  pay: (dto: PayClearanceAgentDto) => api.post('/clearance/pay', dto),
  update: (id: string, dto: UpdateClearanceMovementDto) => api.patch(`/clearance/${id}`, dto),
  remove: (id: string) => api.del<void>(`/clearance/${id}`),
};
