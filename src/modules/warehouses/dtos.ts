export interface Warehouse {
  id: string;
  name: string;
}

export interface StockRow {
  productId: string;
  name: string;
  unit?: string | null;
  qty: number;
  cost: number;
  value: number;
}

export interface WarehouseDto {
  name: string;
}
