import { api } from '@/lib/api';
import type { AppConfig, UpdateConfigDto } from './dtos';

export const configApi = {
  get: () => api.get<AppConfig>('/config'),
  update: (dto: UpdateConfigDto) => api.put<AppConfig>('/config', dto),
};
