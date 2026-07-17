'use client';

import { useQuery } from '@tanstack/react-query';
import { reportsApi } from './api';

type R = { from?: string; to?: string };

export const useReportSummary = ({ from, to }: R) =>
  useQuery({ queryKey: ['reports', 'summary', from, to], queryFn: () => reportsApi.summary(from, to) });

export const useTopProducts = ({ from, to }: R) =>
  useQuery({ queryKey: ['reports', 'top-products', from, to], queryFn: () => reportsApi.topProducts(from, to) });

export const useTopClients = ({ from, to }: R) =>
  useQuery({ queryKey: ['reports', 'top-clients', from, to], queryFn: () => reportsApi.topClients(from, to) });

export const useTopSuppliers = ({ from, to }: R) =>
  useQuery({ queryKey: ['reports', 'top-suppliers', from, to], queryFn: () => reportsApi.topSuppliers(from, to) });

export const useBusiest = ({ from, to }: R) =>
  useQuery({ queryKey: ['reports', 'busiest', from, to], queryFn: () => reportsApi.busiest(from, to) });

export const useInactiveClients = (days: number) =>
  useQuery({ queryKey: ['reports', 'inactive-clients', days], queryFn: () => reportsApi.inactiveClients(days) });

export const useProfitLoss = ({ from, to }: R) =>
  useQuery({ queryKey: ['reports', 'profit-loss', from, to], queryFn: () => reportsApi.profitLoss(from, to) });

export const useWarehouseExpenses = ({ from, to }: R) =>
  useQuery({ queryKey: ['reports', 'warehouse-expenses', from, to], queryFn: () => reportsApi.warehouseExpenses(from, to) });

export const useCustodyBalances = () =>
  useQuery({ queryKey: ['reports', 'custody-balances'], queryFn: () => reportsApi.custodyBalances() });

export const useExpensesByCategory = ({ from, to }: R) =>
  useQuery({ queryKey: ['reports', 'expenses-by-category', from, to], queryFn: () => reportsApi.expensesByCategory(from, to) });

export const useBusiestFor = (type: 'client' | 'supplier' | 'product', id: string | null, { from, to }: R) =>
  useQuery({ queryKey: ['reports', 'busiest-for', type, id, from, to], queryFn: () => reportsApi.busiestFor(type, id as string, from, to), enabled: !!id });
