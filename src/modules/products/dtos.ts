export interface Product {
  id: string;
  name: string;
  unit?: string | null;
  service?: boolean;
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
}

export interface UpdateProductDto {
  name?: string;
  unit?: string;
  service?: boolean;
}
