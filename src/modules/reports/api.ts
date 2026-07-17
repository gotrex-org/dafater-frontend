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
export interface ProfitLoss { revenue: number; cost: number; goodsExpenses: number; grossProfit: number; expenses: number; warehouseExpenses: number; settlement: number; netProfit: number; }
export interface WarehouseExpenseRow { id: string; name: string; total: number; categories: { name: string; total: number }[]; }
export interface WarehouseExpenses { total: number; warehouses: WarehouseExpenseRow[]; }
export interface CustodyHolder { id: string; name: string; balance: number; }
export interface CustodyBalances { total: number; holders: CustodyHolder[]; }
export interface ExpenseGroupRow { key: 'WAREHOUSE' | 'EXTERNAL'; label: string; total: number; items: { name: string; total: number }[]; }
export interface ExpensesByCategory { total: number; groups: ExpenseGroupRow[]; }
export interface BusiestFor { months: { month: string; total: number; count: number }[]; peak: { month: string; total: number; count: number } | null; }

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
  warehouseExpenses: (from?: string, to?: string) => api.get<WarehouseExpenses>(`/reports/warehouse-expenses${range(from, to)}`),
  custodyBalances: () => api.get<CustodyBalances>('/reports/custody-balances'),
  expensesByCategory: (from?: string, to?: string) => api.get<ExpensesByCategory>(`/reports/expenses-by-category${range(from, to)}`),
  busiestFor: (type: 'client' | 'supplier' | 'product', id: string, from?: string, to?: string) =>
    api.get<BusiestFor>(`/reports/busiest-for?type=${type}&id=${encodeURIComponent(id)}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`),
};
