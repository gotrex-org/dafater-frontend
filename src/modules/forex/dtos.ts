export interface DollarAgent {
  id: string;
  name: string;
  phone?: string | null;
  note?: string | null;
  egpIn: number;
  egpOut: number;
  balance: number;
}

export interface DollarAgentTx {
  id: string;
  date: string;
  type: 'EGP_IN' | 'USD_OUT' | 'SETTLE';
  egpAmount: number;
  usdAmount: number;
  exchangeRate: number;
  note?: string | null;
  treasury?: { id: string; name: string } | null;
  party?: { id: string; name: string } | null;
}

export interface DollarAgentDetail extends DollarAgent {
  txs: DollarAgentTx[];
}

export interface CreateAgentDto { name: string; phone?: string; note?: string }
export interface UpdateAgentDto { name?: string; phone?: string; note?: string }
export interface EgpInDto { date: string; egpAmount: number; treasuryId?: string; note?: string }
export interface UsdOutDto { date: string; usdAmount: number; exchangeRate: number; partyId: string; note?: string }
export interface SettleDto { date: string; egpAmount: number; direction: 'in' | 'out'; treasuryId?: string; note?: string }
