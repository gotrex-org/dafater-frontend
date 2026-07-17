export interface DealItem {
  id?: string;
  productId: string;
  qty: number;
  price: number; // sell
  buyPrice?: number;
  product?: { id: string; name: string };
  // تكاليف إضافية على البند (زي الفواتير — ناولون خارجي/شاي/عمولة)
  freight?: number;
  freightTreasuryId?: string;
  freightNote?: string | null;
  freightTreasury?: { id: string; name: string } | null;
  tea?: number;
  teaTreasuryId?: string;
  teaNote?: string | null;
  teaTreasury?: { id: string; name: string } | null;
  commissionQty?: number;
  commissionPrice?: number;
  commissionPartyId?: string;
  commissionParty?: { id: string; name: string } | null;
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
