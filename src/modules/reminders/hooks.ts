'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { remindersApi } from './api';
import type { CreateReminderDto } from './dtos';

export const reminderKeys = { all: ['reminders'] as const };

export function useReminders(enabled = true) {
  return useQuery({ queryKey: reminderKeys.all, queryFn: () => remindersApi.list(), enabled });
}

export function useReminderDueCount(enabled = true) {
  return useQuery({
    queryKey: ['reminders', 'due-count'],
    queryFn: () => remindersApi.dueCount(),
    enabled,
    refetchInterval: 5 * 60 * 1000, // re-check every few minutes
  });
}

function useReminderMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: reminderKeys.all }),
  });
}

export const useCreateReminder = () => useReminderMutation((dto: CreateReminderDto) => remindersApi.create(dto));
export const useUpdateReminder = () => useReminderMutation(({ id, dto }: { id: string; dto: Partial<CreateReminderDto> }) => remindersApi.update(id, dto));
export const useReminderDone = () => useReminderMutation((id: string) => remindersApi.done(id));
export const useReminderUndo = () => useReminderMutation((id: string) => remindersApi.undo(id));
export const useDeleteReminder = () => useReminderMutation((id: string) => remindersApi.remove(id));
