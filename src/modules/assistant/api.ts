import { api } from '@/lib/api';

export interface ChatMessage { role: 'user' | 'assistant'; content: string; }

export const assistantApi = {
  status: () => api.get<{ configured: boolean }>('/assistant/status'),
  chat: (messages: ChatMessage[]) => api.post<{ reply: string }>('/assistant/chat', { messages }),
};
