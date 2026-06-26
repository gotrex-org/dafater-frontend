import { api } from '@/lib/api';
import { toQuery, ListParams } from '@/lib/list-params';
import type { Paginated } from '@/lib/types';
import type { User, CreateUserDto, UpdateUserDto } from './dtos';

export const usersApi = {
  list: (params: ListParams = {}) => api.get<Paginated<User>>(`/users${toQuery(params)}`),
  create: (dto: CreateUserDto) => api.post<User>('/users', dto),
  update: (id: string, dto: UpdateUserDto) => api.patch<User>(`/users/${id}`, dto),
  remove: (id: string) => api.del<void>(`/users/${id}`),
};
