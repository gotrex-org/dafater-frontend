export interface Warehouse {
  id: string;
  name: string;
}

export interface StockRow {
  productId: string;
  name: string;
  unit?: string | null;
  qty: number;
  /** سعر تقييم المخزون (المحسوب أو المحطوط يدوي) */
  cost: number;
  /** سعر الشراء الثابت للصنف — بيتحط تلقائيًا في سطر فاتورة الشراء */
  purchasePrice?: number;
  /** سعر البيع الثابت للصنف — بيتحط تلقائيًا في سطر فاتورة البيع */
  salePrice?: number;
  value: number;
}

export interface WarehouseDto {
  name: string;
}
