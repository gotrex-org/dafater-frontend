import { api } from '@/lib/api';
import type { Reminder, CreateReminderDto } from './dtos';

export const remindersApi = {
  list: () => api.get<Reminder[]>('/reminders'),
  dueCount: () => api.get<{ count: number }>('/reminders/due-count'),
  create: (dto: CreateReminderDto) => api.post<Reminder>('/reminders', dto),
  update: (id: string, dto: Partial<CreateReminderDto>) => api.patch<Reminder>(`/reminders/${id}`, dto),
  done: (id: string) => api.post<void>(`/reminders/${id}/done`, {}),
  undo: (id: string) => api.post<void>(`/reminders/${id}/undo`, {}),
  remove: (id: string) => api.del<void>(`/reminders/${id}`),
};
