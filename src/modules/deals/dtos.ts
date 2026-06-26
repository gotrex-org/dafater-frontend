export interface DealItem {
  id?: string;
  productId: string;
  qty: number;
  price: number; // sell
  buyPrice?: number;
  product?: { id: string; name: string };
}

export interface Deal {
  id: string;
  no: string;
  date: string;
  clientId: string;
  supplierId: string;
  paidIn: number;
  paidOut: number;
  nawlon: number;
  note?: string | null;
  client?: { id: string; name: string };
  supplier?: { id: string; name: string };
  treasury?: { id: string; name: string } | null;
  items: DealItem[];
}

export interface CreateDealDto {
  no?: string;
  date: string;
  clientId: string;
  supplierId: string;
  items: DealItem[];
  paidIn?: number;
  paidOut?: number;
  treasuryId?: string;
  note?: string;
  commissionAmount?: number;
  commissionPartyId?: string;
  nawlon?: number;
}
