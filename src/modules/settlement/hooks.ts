'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { settlementApi } from './api';
import type {
  CapitalMovementInput, CreatePriceListDto, PartnerUpsertDto, PaymentInput, UpdatePriceListDto,
  UpdateVehicleDto, ItemRef,
} from './dtos';

const KEY = 'settlement';

export function usePartners() {
  return useQuery({ queryKey: [KEY, 'partners'], queryFn: () => settlementApi.partners() });
}

export function useSettlementOverview(partnerId: string | null) {
  return useQuery({
    queryKey: [KEY, 'overview', partnerId],
    queryFn: () => settlementApi.overview(partnerId!),
    enabled: !!partnerId,
  });
}

export function usePriceLists(partnerId: string | null) {
  return useQuery({
    queryKey: [KEY, 'price-lists', partnerId],
    queryFn: () => settlementApi.priceLists(partnerId!),
    enabled: !!partnerId,
  });
}

export function useSupplierProducts(partnerId: string | null, supplierId?: string) {
  return useQuery({
    queryKey: [KEY, 'products', partnerId, supplierId ?? null],
    queryFn: () => settlementApi.products(partnerId!, supplierId),
    enabled: !!partnerId,
  });
}

export function useCandidates(partnerId: string | null, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'candidates', partnerId],
    queryFn: () => settlementApi.candidates(partnerId!),
    enabled: !!partnerId && enabled,
  });
}

export function useVehicle(partnerId: string | null, id: string | null) {
  return useQuery({
    queryKey: [KEY, 'vehicle', partnerId, id],
    queryFn: () => settlementApi.vehicle(partnerId!, id!),
    enabled: !!partnerId && !!id,
  });
}

/**
 * أي كتابة بتغيّر الحسبة كلها (سعر أسبوع واحد بيمسّ كل العربيات اللي بتقرا منه،
 * ونفس القايمة ممكن تكون مشتركة بين أكتر من اسم)، فبنبطّل كاش الموديول كله.
 */
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [KEY] });
  // التصفية الثابتة بتتسجل في الخزنة وحساب الاسم والتقارير
  qc.invalidateQueries({ queryKey: ['treasury'] });
  qc.invalidateQueries({ queryKey: ['parties'] });
  qc.invalidateQueries({ queryKey: ['reports'] });
}

export function useCreatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: PartnerUpsertDto & { name: string }) => settlementApi.createPartner(dto),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: PartnerUpsertDto }) =>
      settlementApi.updatePartner(id, dto),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeletePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settlementApi.deletePartner(id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCreatePriceList(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePriceListDto) => settlementApi.createPriceList(partnerId, dto),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdatePriceList(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdatePriceListDto }) =>
      settlementApi.updatePriceList(partnerId, id, dto),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSelectVehicles(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceIds: string[]) => settlementApi.select(partnerId, invoiceIds),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSelectAllVehicles(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => settlementApi.selectAll(partnerId),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUnselectVehicle(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settlementApi.unselect(partnerId, id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateVehicle(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateVehicleDto }) =>
      settlementApi.updateVehicle(partnerId, id, dto),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSetItemWeek(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, productId, priceListId }:
      { invoiceId: string; productId: string; priceListId: string | null }) =>
      settlementApi.setItemWeek(partnerId, invoiceId, productId, priceListId),
    onSuccess: () => invalidateAll(qc),
  });
}

// ------------------------------ كشف الحساب ------------------------------

export function useStatement(partnerId: string | null, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'statement', partnerId],
    queryFn: () => settlementApi.statement(partnerId!),
    enabled: !!partnerId && enabled,
  });
}

// ------------------------------- الدفعات -------------------------------

export function usePayments(partnerId: string | null, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'payments', partnerId],
    queryFn: () => settlementApi.payments(partnerId!),
    enabled: !!partnerId && enabled,
  });
}

export function useAddPayment(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: PaymentInput) => settlementApi.addPayment(partnerId, dto),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeletePayment(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settlementApi.deletePayment(partnerId, id),
    onSuccess: () => invalidateAll(qc),
  });
}

// ----------------------------- رأس المال -----------------------------

export function useCapital(partnerId: string | null, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'capital', partnerId],
    queryFn: () => settlementApi.capital(partnerId!),
    enabled: !!partnerId && enabled,
  });
}

export function useAddCapitalMovement(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CapitalMovementInput) => settlementApi.addCapital(partnerId, dto),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteCapitalMovement(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settlementApi.deleteCapital(partnerId, id),
    onSuccess: () => invalidateAll(qc),
  });
}

// --------------------- التصفية الثابتة (أصناف من فواتير الشراء) ---------------------

export function useFixedItems(partnerId: string | null, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'fixed', partnerId],
    queryFn: () => settlementApi.fixed(partnerId!),
    enabled: !!partnerId && enabled,
  });
}

/** «اختيار الأصناف»: البحث بعد كتابة اسم الصنف فقط. */
export function useItemSearch(partnerId: string | null, q: string, from?: string, to?: string) {
  return useQuery({
    queryKey: [KEY, 'item-search', partnerId, q, from, to],
    queryFn: () => settlementApi.searchItems(partnerId!, q, from, to),
    enabled: !!partnerId && !!q.trim(),
  });
}

export function useAddItems(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: ItemRef[]) => settlementApi.addItems(partnerId, items),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRemoveItem(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ref: ItemRef) => settlementApi.removeItem(partnerId, ref),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSetItemRate(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ref, body }: { ref: ItemRef; body: { rate: number } | { percent: number } }) =>
      settlementApi.setItemRate(partnerId, ref, body),
    onSuccess: () => invalidateAll(qc),
  });
}

// ------------------------------ تقرير التصفيات ------------------------------

export function useSettlementReport() {
  return useQuery({ queryKey: [KEY, 'report'], queryFn: () => settlementApi.report() });
}

/**
 * صلاحيات المدير داخل التصفية. الحساب المربوط باسم يرى تصفيته فقط كصاحب اسم، حتى لو
 * كان أدمن — إلا المالك (isPrimary). نفس قاعدة SettlementViewerGuard في الـ API.
 */
export function useSettlementAdmin() {
  const { user } = useAuth();
  const { data: partners } = usePartners();
  if (!user?.admin) return false;
  if (user.isPrimary) return true;
  return !(partners ?? []).some((p) => p.user?.id === user.id);
}

// -------------------------------- الترحيل --------------------------------

export function usePostItems(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { date?: string; note?: string }) => settlementApi.post(partnerId, dto),
    onSuccess: () => invalidateAll(qc),
  });
}

export function usePosting(partnerId: string, id: string | null) {
  return useQuery({
    queryKey: [KEY, 'posting', partnerId, id],
    queryFn: () => settlementApi.posting(partnerId, id!),
    enabled: !!id,
  });
}

export function useDeletePosting(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settlementApi.deletePosting(partnerId, id),
    onSuccess: () => invalidateAll(qc),
  });
}
