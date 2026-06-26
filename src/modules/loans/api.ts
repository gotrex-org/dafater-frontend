import { api, http } from '@/lib/api';
import type { Loan, CreateLoanDto, ReturnLoanDto } from './dtos';

export const loansApi = {
  list: (params?: { warehouseId?: string; status?: string }) =>
    http.get<Loan[]>('/loans', { params }).then((r) => r.data),
  create: (dto: CreateLoanDto) => api.post<Loan>('/loans', dto),
  return: (id: string, dto: ReturnLoanDto) => api.patch<Loan>(`/loans/${id}/return`, dto),
  remove: (id: string) => api.del<void>(`/loans/${id}`),
};
