export type OrderStatus = 'NEW' | 'DONE';

export interface OrderItem {
  id?: string;
  name: string;
  qty: number;
  received?: number;
}

export interface Order {
  id: string;
  date: string;
  name: string;
  phone?: string | null;
  note?: string | null;
  status: OrderStatus;
  items: OrderItem[];
  party?: { uid: string; name: string } | null;
}

export interface CreateOrderDto {
  name: string;
  phone?: string;
  note?: string;
  items: { name: string; qty: number }[];
}

export interface UpdateOrderDto {
  name?: string;
  phone?: string;
  note?: string;
  items?: { name: string; qty: number }[];
}
