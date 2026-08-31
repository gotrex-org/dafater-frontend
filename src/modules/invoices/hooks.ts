'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoicesApi, InvoiceListParams } from './api';
import type { CreateInvoiceDto, UpdateInvoiceDto } from './dtos';

export const invoiceKeys = {
  all: ['invoices'] as const,
  list: (params: InvoiceListParams) => ['invoices', 'list', params] as const,
};

export function useInvoices(params: InvoiceListParams = {}) {
  return useQuery({ queryKey: invoiceKeys.list(params), queryFn: () => invoicesApi.list(params) });
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: ['invoices', 'one', id],
    queryFn: () => invoicesApi.get(id as string),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateInvoiceDto) => invoicesApi.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      // ledger balances, treasury and stock are derived from invoices
      qc.invalidateQueries({ queryKey: ['parties'] });
      qc.invalidateQueries({ queryKey: ['treasury'] });
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateInvoiceDto }) => invoicesApi.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      qc.invalidateQueries({ queryKey: ['parties'] });
      qc.invalidateQueries({ queryKey: ['treasury'] });
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateInvoiceCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { commissionAmount?: number; commissionPartyId?: string } }) =>
      invoicesApi.updateCommission(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      qc.invalidateQueries({ queryKey: ['parties'] });
      qc.invalidateQueries({ queryKey: ['treasury'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cascade }: { id: string; cascade?: boolean }) => invoicesApi.remove(id, cascade),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      qc.invalidateQueries({ queryKey: ['parties'] });
      qc.invalidateQueries({ queryKey: ['treasury'] });
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// أرقام شكل الشيت (حساب قديم / سدادات / الباقي عليه) لفاتورة واحدة
export function useInvoiceSheet(id: string | null) {
  return useQuery({
    queryKey: ['invoices', 'sheet', id],
    queryFn: () => invoicesApi.sheet(id as string),
    enabled: !!id,
  });
}

// تابات العربيات جوّه الفاتورة
export function useManifestTabs(id: string | null) {
  return useQuery({
    queryKey: ['invoices', 'manifest-tabs', id],
    queryFn: () => invoicesApi.manifestTabs(id as string),
    enabled: !!id,
  });
}

export function useSetManifestTabClosed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, closed }: { uid: string; closed: boolean }) => invoicesApi.setManifestTabClosed(uid, closed),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices', 'manifest-tabs'] }),
  });
}

// أرشفة/استعادة فاتورة — إخفاء من القوايم بس، الحركات ما بتتلمسش
export function useSetInvoiceArchived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => invoicesApi.setArchived(id, archived),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}
