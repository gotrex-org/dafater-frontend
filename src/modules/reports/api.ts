import { api } from '@/lib/api';

export interface TopProduct { id: string; name: string; unit: string | null; qty: number; revenue: number; }
export interface TopParty { id: string; name: string; total: number; count: number; }
export interface PeriodStat { month?: string; day?: string; total: number; count: number; }
export interface Busiest {
  months: { month: string; total: number; count: number }[];
  weekdays: { day: string; total: number; count: number }[];
  peakMonth: { month: string; total: number; count: number } | null;
  peakDay: { day: string; total: number; count: number } | null;
}
export interface ReportSummary {
  sales: number; purchases: number; salesCount: number; purchasesCount: number;
  salesReturns: number; purchaseReturns: number; netSales: number; grossProfit: number;
}
export interface InactiveClient { id: string; name: string; lastActivity: string | null; daysSince: number | null; }
export interface ProfitLoss { revenue: number; cost: number; grossProfit: number; expenses: number; netProfit: number; }

const range = (from?: string, to?: string) => {
  const p = new URLSearchParams();
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const reportsApi = {
  summary: (from?: string, to?: string) => api.get<ReportSummary>(`/reports/summary${range(from, to)}`),
  topProducts: (from?: string, to?: string) => api.get<TopProduct[]>(`/reports/top-products${range(from, to)}`),
  topClients: (from?: string, to?: string) => api.get<TopParty[]>(`/reports/top-clients${range(from, to)}`),
  topSuppliers: (from?: string, to?: string) => api.get<TopParty[]>(`/reports/top-suppliers${range(from, to)}`),
  busiest: (from?: string, to?: string) => api.get<Busiest>(`/reports/busiest${range(from, to)}`),
  inactiveClients: (days?: number) => api.get<InactiveClient[]>(`/reports/inactive-clients${days ? `?days=${days}` : ''}`),
  profitLoss: (from?: string, to?: string) => api.get<ProfitLoss>(`/reports/profit-loss${range(from, to)}`),
};
