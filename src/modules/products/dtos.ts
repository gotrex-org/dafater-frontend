export interface Product {
  id: string;
  name: string;
  unit?: string | null;
  service?: boolean;
  pinSale?: boolean;
  pinPurchase?: boolean;
  price?: number;
}

export interface LastPrice {
  productId: string;
  price: number;
  date: string;
}

export interface ProductMovement {
  id: string;
  date: string;
  kind: 'SALE' | 'PURCHASE';
  party?: string | null;
  warehouse?: string | null;
  no: string;
  qty: number;
  price: number;
}

export interface CreateProductDto {
  name: string;
  unit?: string;
  service?: boolean;
  pinSale?: boolean;
  pinPurchase?: boolean;
  price?: number;
}

export interface UpdateProductDto {
  name?: string;
  unit?: string;
  service?: boolean;
  pinSale?: boolean;
  pinPurchase?: boolean;
  price?: number;
}
