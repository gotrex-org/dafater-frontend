import { api } from '@/lib/api';
import type {
  AddClearanceExpenseDto, ClearanceAgent, ClearanceList,
  ClearanceQuery, PayClearanceAgentDto,
} from './dtos';

const qs = (q: ClearanceQuery) => {
  const p = new URLSearchParams();
  if (q.agentId) p.set('agentId', q.agentId);
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const clearanceApi = {
  agents: () => api.get<ClearanceAgent[]>('/clearance/agents'),
  list: (q: ClearanceQuery = {}) => api.get<ClearanceList>(`/clearance${qs(q)}`),
  addExpense: (dto: AddClearanceExpenseDto) => api.post('/clearance/expense', dto),
  pay: (dto: PayClearanceAgentDto) => api.post('/clearance/pay', dto),
  remove: (id: string) => api.del<void>(`/clearance/${id}`),
};
