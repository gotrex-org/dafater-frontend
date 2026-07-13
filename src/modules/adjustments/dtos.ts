export interface Adjustment {
  id: string;
  uid: string;
  date: string;
  qty: number;
  note?: string | null;
  product: { uid: string; name: string };
  warehouse: { uid: string; name: string };
}

export interface CreateAdjustmentDto {
  date: string;
  warehouseId: string;
  productId: string;
  qty: number;
  note?: string;
}

export interface TransferStockItem { productId: string; qty: number; }
export interface TransferStockDto {
  date: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  items: TransferStockItem[];
  note?: string;
}
