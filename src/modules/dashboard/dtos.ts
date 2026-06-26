import type { TreasuryAccount } from '../treasury/dtos';
import type { PartyRole } from '../parties/dtos';

export interface DashboardStats {
  receivable: number;
  payable: number;
  cashByCurrency: Record<string, number>;
  inventoryValue: number;
  treasury: TreasuryAccount[];
  warehouses: { id: string; name: string; value: number }[];
  topBalances: { id: string; name: string; role: PartyRole; balance: number }[];
  counts: { clients: number; suppliers: number; products: number; invoices: number };
}
