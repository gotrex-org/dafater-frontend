import { api } from '@/lib/api';
import type { AuthUser } from '@/lib/types';
import type { LoginDto } from './dtos';

export const authApi = {
  login: (dto: LoginDto) => api.post<{ token: string; user: AuthUser }>('/auth/login', dto),
  me: () => api.get<AuthUser>('/auth/me'),
};
