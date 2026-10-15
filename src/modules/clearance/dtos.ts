/** حركة تخليص: جمرك وتخليص على عربية، أو دفعة لمكتب التخليص. */
export interface ClearanceMovement {
  id: string;
  date: string;
  type: string;      // «جمارك» أو «سداد مخلّص» (أو أي حركة على حساب المكتب في كشف الحساب)
  debit: number;     // دفعة للمكتب
  credit: number;    // مصروف اترحّل للمكتب
  cashOut?: number;
  exchangeRate?: number;
  /** التخليص النقدي: رجلين (مصروف + دفعة) بنفس groupId */
  groupId?: string | null;
  activity?: import('@/lib/activity').Activity;
  note?: string | null;
  party?: { id: string; name: string } | null;
  manifest?: {
    id: string; no: string; date: string;
    clientName: string; vehicleLabel?: string | null; vehicleNo?: string | null; trailerNo?: string | null;
  } | null;
  category?: { id: string; name: string } | null;
  treasury?: { id: string; name: string; currency?: 'EGP' | 'USD' } | null;
  /** في كشف الحساب: المستحق للمكتب بعد الحركة */
  balance?: number;
}

/** ملخّص المكتب في الفترة + المستحق له إجمالاً. */
export interface ClearanceAgentSummary {
  id: string;
  name: string;
  phone?: string | null;
  note?: string | null;
  hidden?: boolean;
  expenses: number;  // اترحّل له في الفترة
  paid: number;      // اتدفع له في الفترة
  due: number;       // المستحق له كله (موجب = له عندنا)
}

export interface ClearanceList {
  movements: ClearanceMovement[];
  agents: ClearanceAgentSummary[];
}

export interface ClearanceAgent {
  id: string;
  name: string;
  phone?: string | null;
  note?: string | null;
  hidden?: boolean;
}

export interface ClearanceStatement {
  agent: { id: string; name: string; phone?: string | null; note?: string | null; hidden?: boolean };
  /** المستحق للمكتب قبل بداية الفترة */
  opening: number;
  rows: ClearanceMovement[];
  totals: { expenses: number; paid: number };
  /** المستحق للمكتب في آخر الفترة */
  closing: number;
}

export interface AddClearanceExpenseDto {
  manifestId: string;
  agentId: string;
  date: string;
  amount: number;
  categoryId?: string;
  note?: string;
}

export interface PayClearanceAgentDto {
  agentId: string;
  date: string;
  amount: number;
  treasuryId: string;
  /** سعر الصرف — للدفع من خزنة دولار */
  rate?: number;
  note?: string;
}

export interface ClearanceAgentDto {
  name: string;
  phone?: string;
  note?: string;
}

export interface ClearanceQuery {
  agentId?: string;
  archived?: boolean;
  from?: string;
  to?: string;
}

export interface AddCashClearanceDto extends AddClearanceExpenseDto {
  treasuryId: string;
  rate?: number;
}

export interface UpdateClearanceMovementDto {
  date?: string;
  amount?: number;
  agentId?: string;
  manifestId?: string;
  treasuryId?: string;
  rate?: number;
  categoryId?: string;
  note?: string;
}
