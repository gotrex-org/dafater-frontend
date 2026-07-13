export type OwnerEntryKind = 'PERSONAL_EXPENSE' | 'COMPANY_PAYMENT' | 'CLIENT_PAYMENT';

export interface OwnerEntry {
  id: string;
  kind: OwnerEntryKind;
  title: string;
  amount: number;
  discount: number;
  date: string;
  note?: string | null;
}

export interface KindTotal { amount: number; discount: number; net: number; count: number; }

export interface FinanceData {
  entries: OwnerEntry[];
  totals: Record<OwnerEntryKind, KindTotal>;
}

export interface CreateOwnerEntryDto {
  kind: OwnerEntryKind;
  title: string;
  amount: number;
  discount?: number;
  date: string;
  note?: string;
}

export const OWNER_KIND_LABEL: Record<OwnerEntryKind, string> = {
  PERSONAL_EXPENSE: 'مصروف شخصي',
  COMPANY_PAYMENT: 'دفعة للشركة',
  CLIENT_PAYMENT: 'دفعة لعميل',
};
