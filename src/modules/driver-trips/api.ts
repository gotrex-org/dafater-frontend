import { api, http } from '@/lib/api';
import type { AddPaymentDto, CreateDriverTripDto, DriverTrip, UpdateDriverTripDto } from './dtos';

export const driverTripsApi = {
  list: (params?: { status?: string; pendingBalance?: boolean }) =>
    http.get<DriverTrip[]>('/driver-trips', { params }).then((r) => r.data),
  create: (dto: CreateDriverTripDto) => api.post<DriverTrip>('/driver-trips', dto),
  get: (id: string) => http.get<DriverTrip>(`/driver-trips/${id}`).then((r) => r.data),
  update: (id: string, dto: UpdateDriverTripDto) => api.patch<DriverTrip>(`/driver-trips/${id}`, dto),
  addPayment: (id: string, dto: AddPaymentDto) => api.post<DriverTrip>(`/driver-trips/${id}/payments`, dto),
  deletePayment: (id: string, payId: string) => api.del<DriverTrip>(`/driver-trips/${id}/payments/${payId}`),
  setArrival: (id: string, arrivalDate: string) => api.patch<DriverTrip>(`/driver-trips/${id}/arrival`, { arrivalDate }),
  remove: (id: string) => api.del<void>(`/driver-trips/${id}`),
};
