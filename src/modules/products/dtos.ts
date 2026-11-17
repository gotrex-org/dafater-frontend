export interface Product {
  id: string;
  name: string;
  unit?: string | null;
  service?: boolean;
  pinSale?: boolean;
  pinPurchase?: boolean;
  price?: number;
  /** سعر شراء ثابت — يُملأ تلقائيًا في سطر فاتورة الشراء وقابل للتعديل عليها */
  purchasePrice?: number;
  /** سعر بيع ثابت — يُملأ تلقائيًا في سطر فاتورة البيع وقابل للتعديل عليها */
  salePrice?: number;
}

export interface LastPrice {
  productId: string;
  price: number;
  date: string;
}

export interface ProductMovement {
  id: string;
  date: string;
  kind: 'SALE' | 'PURCHASE' | 'SALE_RETURN' | 'PURCHASE_RETURN' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'LOAN' | 'LOAN_RETURN';
  party?: string | null;
  warehouse?: string | null;
  no: string;
  qty: number;
  /** السعر بعملة المستند (null للتسوية والإعارة) */
  price: number | null;
  currency?: string;
  /** السعر بالمصري — null لو دولار لسه ما اتسعّرش */
  priceEgp?: number | null;
  /** رصيد الصنف بعد الحركة في كل المخازن — null للبيع الخارجي والفاتورة الوهمية */
  balance?: number | null;
  fake?: boolean;
}

export interface CreateProductDto {
  name: string;
  unit?: string;
  service?: boolean;
  pinSale?: boolean;
  pinPurchase?: boolean;
  price?: number;
  /** سعر شراء ثابت — يُملأ تلقائيًا في سطر فاتورة الشراء وقابل للتعديل عليها */
  purchasePrice?: number;
  /** سعر بيع ثابت — يُملأ تلقائيًا في سطر فاتورة البيع وقابل للتعديل عليها */
  salePrice?: number;
}

export interface UpdateProductDto {
  name?: string;
  unit?: string;
  service?: boolean;
  pinSale?: boolean;
  pinPurchase?: boolean;
  price?: number;
  /** سعر شراء ثابت — يُملأ تلقائيًا في سطر فاتورة الشراء وقابل للتعديل عليها */
  purchasePrice?: number;
  /** سعر بيع ثابت — يُملأ تلقائيًا في سطر فاتورة البيع وقابل للتعديل عليها */
  salePrice?: number;
}
