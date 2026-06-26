import { api } from '@/lib/api';
import type { DashboardStats } from './dtos';

export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard'),
};
