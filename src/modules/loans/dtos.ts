export interface LoanReturn {
  id: string;
  date: string;
  returnType: 'GOODS' | 'CASH' | 'DEBT';
  qty: number;
  pricePerUnit?: number | null;
  note?: string | null;
  txId?: number | null;
  createdAt: string;
}

export interface Loan {
  id: string;
  date: string;
  borrowerName?: string | null;
  party?: { uid: string; name: string; role: string } | null;
  qty: number;
  note?: string;
  status: 'OPEN' | 'RETURNED';
  returnType?: 'GOODS' | 'CASH' | 'DEBT' | 'MIXED';
  returnedQty: number;
  cashReturnedQty: number;
  returnDate?: string;
  returnNote?: string;
  product: { id: string; name: string; unit?: string };
  warehouse: { id: string; name: string };
  returns: LoanReturn[];
  createdAt: string;
}

export interface CreateLoanDto {
  date: string;
  partyId?: string;
  borrowerName?: string;
  productId: string;
  warehouseId: string;
  qty: number;
  note?: string;
}

export interface ReturnLoanDto {
  returnDate: string;
  returnType: 'GOODS' | 'CASH' | 'DEBT';
  returnedQty: number;
  pricePerUnit?: number;
  treasuryId?: string;
  debtPartyId?: string;
  returnNote?: string;
}
