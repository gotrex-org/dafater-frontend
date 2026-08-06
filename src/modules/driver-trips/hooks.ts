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
    onSuccess: () => invalidateAfterPayment(qc),
  });
}

export function useUpdateDriverTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateDriverTripDto }) => driverTripsApi.update(id, dto),
    onSuccess: () => invalidateAfterPayment(qc),
  });
}

function invalidateAfterPayment(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [KEY] });
  qc.invalidateQueries({ queryKey: ['parties'] });
  qc.invalidateQueries({ queryKey: ['treasury'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
}

export function useAddPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: AddPaymentDto }) => driverTripsApi.addPayment(id, dto),
    onSuccess: () => invalidateAfterPayment(qc),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payId }: { tripId: string; payId: string }) => driverTripsApi.deletePayment(tripId, payId),
    onSuccess: () => invalidateAfterPayment(qc),
  });
}

export function useUpdateWeightDiff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => driverTripsApi.patchWeightDiff(id, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ['parties'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useSetArrival() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, arrivalDate, weightDiffAmount }: { id: string; arrivalDate: string; weightDiffAmount?: number }) =>
      driverTripsApi.setArrival(id, { arrivalDate, weightDiffAmount }),
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
