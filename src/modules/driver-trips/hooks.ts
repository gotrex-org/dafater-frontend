'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { driverTripsApi } from './api';
import type { AddPaymentDto, CreateDriverTripDto, UpdateDriverTripDto } from './dtos';

const KEY = 'driver-trips';

export function useDriverTrips(params?: { status?: string; pendingBalance?: boolean }) {
  return useQuery({
    queryKey: [KEY, params?.status, params?.pendingBalance],
    queryFn: () => driverTripsApi.list(params),
  });
}

export function usePendingDriverTrips() {
  return useQuery({
    queryKey: [KEY, 'pendingBalance'],
    queryFn: () => driverTripsApi.list({ pendingBalance: true }),
  });
}

export function useDriverTrip(id: string) {
  return useQuery({
    queryKey: [KEY, id],
    queryFn: () => driverTripsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateDriverTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDriverTripDto) => driverTripsApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateDriverTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateDriverTripDto }) => driverTripsApi.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useAddPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: AddPaymentDto }) => driverTripsApi.addPayment(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payId }: { tripId: string; payId: string }) => driverTripsApi.deletePayment(tripId, payId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useSetArrival() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, arrivalDate }: { id: string; arrivalDate: string }) => driverTripsApi.setArrival(id, arrivalDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ['parties'] });
    },
  });
}

export function useDeleteDriverTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => driverTripsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
