/** حركة تخليص: مصروف جمارك على عربية، أو سداد للمخلّص. */
export interface ClearanceMovement {
  id: string;
  uid: string;
  date: string;
  type: string;      // «جمارك» أو «سداد مخلّص»
  debit: number;     // سداد
  credit: number;    // مصروف اترحّل للمخلّص
  note?: string | null;
  party?: { uid: string; name: string } | null;
  manifest?: {
    uid: string; no: string; date: string;
    clientName: string; vehicleLabel?: string | null; vehicleNo?: string | null;
  } | null;
  category?: { uid: string; name: string } | null;
  treasury?: { uid: string; name: string } | null;
}

/** ملخّص المخلّص في الفترة + المستحق له إجمالاً. */
export interface ClearanceAgentSummary {
  uid: string;
  name: string;
  phone?: string | null;
  expenses: number;  // اترحّل له في الفترة
  paid: number;      // اتسدّد له في الفترة
  due: number;       // المستحق له كله (موجب = ليه عندنا)
}

export interface ClearanceList {
  movements: ClearanceMovement[];
  agents: ClearanceAgentSummary[];
}

export interface ClearanceAgent {
  uid: string;
  name: string;
  phone?: string | null;
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
  note?: string;
}

export interface ClearanceQuery {
  agentId?: string;
  from?: string;
  to?: string;
}
