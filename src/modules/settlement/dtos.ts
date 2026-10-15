/**
 * تاب «تصفية» — أنواع الـ API.
 * الحسبة كلها على السيرفر (SettlementService)، والواجهة بتعرض بس.
 *
 * ملحوظة تسمية: الكود بيسمّي الكيان `partner`، لكن كل اللي بيبان للمستخدم
 * هو اسم الشخص نفسه (مازن…) — مفيش كلمة «شريك» في الواجهة.
 */

/** CAPITAL = برأس المال · FIXED = تصفية ثابتة (مبلغ للوحدة) */
export type ShareBasis = 'CAPITAL' | 'FIXED';

export interface Partner {
  id: string;
  name: string;
  shareBasis: ShareBasis;
  /** رأس المال الافتتاحي — بسط معادلة النسبة في CAPITAL */
  capital: number;
  /** مصروف تشغيل لكل كرتونة. 0 = مفيش خصم. */
  cartonExpense: number;
  active: boolean;
  note: string | null;
  /** الموردين اللي أصنافهم بتتحسب له. فاضية = كل أصناف الفاتورة. */
  suppliers: { id: string; name: string; currency: 'EGP' | 'USD' }[];
  user: { id: string; name: string; username: string | null } | null;
}

/** سطر صنف جوّه عربية. سعر الشراء `null` = الصنف مش متسعّر في قايمة أسبوعه. */
export interface VehicleLine {
  id: string;
  productId: string;
  productName: string;
  unit?: string | null;
  qty: number;
  /** `null` لو الفاتورة بالدولار ومفيش سعر صرف */
  salePrice: number | null;
  purchasePrice: number | null;
  capital: number | null;
  profit: number | null;
  weekId: string | null;
  weekStart: string | null;
  weekEnd: string | null;
  /** السعر جاي من أسبوع مفروض على الصنف، مش أسبوع تاريخ الفاتورة */
  weekForced: boolean;
}

export interface Vehicle {
  id: string;           // uid فاتورة البيع
  selected: boolean;
  invoiceNo: string;
  date: string;
  hidden: boolean;
  clientName: string;
  currency: 'EGP' | 'USD';
  exchangeRate?: number | null;
  /** فاتورة بالدولار من غير سعر صرف — الربح والنصيب مش محسوبين */
  needsRate: boolean;
  /** تاريخ الفاتورة خارج كل فترات قوائم الأسعار */
  noPricePeriod: boolean;
  /** رأس + مقطورة من كشف العربية */
  vehicleNo: string | null;
  vehicleLabel: string | null;
  manifestNo: string | null;
  capital: number;
  cartons: number;
  cartonsOverridden: boolean;
  opExpense: number;
  /** رأس مال الاسم في تاريخ هذه الفاتورة — بسط معادلة النسبة */
  ownCapital: number;
  percent: number;
  grossProfit: number | null;
  profit: number | null;
  share: number | null;
  note: string | null;
  itemCount: number;
  unpricedCount: number;
  /** فيها صنف بدون سعر — الفاتورة كلها غير محسوبة حتى تُسعَّر */
  needsPricing: boolean;
  warnings: string[];
}

export interface VehicleDetail extends Vehicle {
  lines: VehicleLine[];
}

export interface SupplierDeposit {
  id: string;
  date: string;
  amount: number;
  /** سعر الإيداع المختوم وقت التوريد */
  depositRate: number;
  egpValue: number;
  agentName: string | null;
  note?: string | null;
}

export interface SupplierInvoiceRow {
  id: string;
  no: string;
  date: string;
  net: number;
  currency: 'EGP' | 'USD';
  exchangeRate?: number | null;
}

/** حساب المورد: الإيداعات رصيد عام بتتخصم منه الفواتير. */
export interface SupplierAccount {
  party: { id: string; name: string; currency: 'EGP' | 'USD' };
  depositsTotal: number;
  invoicesTotal: number;
  /** الإيداعات − الفواتير */
  balance: number;
  /** رصيد الطرف الكامل في كشف الحساب — بيختلف لو فيه حركات تانية عليه */
  ledgerBalance: number;
  /** توجد فواتير بعملة غير الدولار بدون سعر صرف — مستبعدة من الطرح */
  mixedCurrency: boolean;
  unconvertedInvoices: number;
  deposits: SupplierDeposit[];
  invoices: SupplierInvoiceRow[];
}

/** إجماليات التصفية برأس المال. `null` في طريقة التصفية الثابتة. */
export interface CapitalTotals {
  /** رأس المال الحالي = الافتتاحي + الإضافات − النقص */
  partnerCapital: number;
  openingCapital: number;
  share: number;
  profit: number;
  capital: number;
  sales: number;
  vehicles: number;
  /** فواتير محتاجة سعر صرف قبل ما تتحسب */
  needsRate: number;
  /** فواتير فيها صنف بدون سعر — كلها خارج الإجماليات حتى تُسعَّر */
  needsPricing: number;
}

/** إجماليات التصفية الثابتة. `null` في التصفية برأس المال. */
export interface FixedTotals {
  due: number;
  qty: number;
  invoices: number;
  /** فواتير مختارة من غير مبلغ للوحدة، فمستحقها مش محسوب */
  needsAmount: number;
}

export interface SettlementOverview {
  partner: Partner;
  totals: CapitalTotals | null;
  fixedTotals: FixedTotals | null;
  /** فواتير الشراء ومستحق كل واحدة — في التصفية الثابتة فقط */
  fixed: FixedInvoice[] | null;
  supplierAccount: SupplierAccount | null;
  vehicles: Vehicle[];
}

export interface PriceListItem {
  id: string;
  productId: string;
  productName: string;
  unit?: string | null;
  price: number;
}

export interface PriceList {
  id: string;
  supplier: { id: string; name: string };
  weekStart: string;
  weekEnd: string;
  note: string | null;
  itemCount: number;
  /** أحدث قايمة — دي الوحيدة اللي غير المالك مسموح له يعدّلها */
  latest: boolean;
  items: PriceListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierProduct {
  id: string;
  name: string;
  unit: string | null;
  hidden: boolean;
  /** بالجنيه. `null` = فاتورة الشراء بالدولار ومفيش سعر صرف، فمفيش مقترح */
  lastPurchasePrice: number | null;
  lastPurchaseCurrency: 'EGP' | 'USD';
  lastListPrice: number | null;
}

export interface PriceListItemInput {
  productId: string;
  price: number;
}

export interface CreatePriceListDto {
  /** مطلوب لو الاسم مربوط بأكتر من مورد */
  supplierId?: string;
  weekStart: string;
  weekEnd: string;
  note?: string;
  items: PriceListItemInput[];
}

export interface UpdatePriceListDto {
  weekStart?: string;
  weekEnd?: string;
  note?: string;
  /** بتـ upsert المبعوت بس — الأصناف التانية في القايمة بتفضل زي ما هي */
  items?: PriceListItemInput[];
  removeProductIds?: string[];
}

export interface UpdateVehicleDto {
  cartons?: number | null;
  note?: string;
}

export interface PartnerUpsertDto {
  name?: string;
  shareBasis?: ShareBasis;
  capital?: number;
  cartonExpense?: number;
  /** قايمة فاضية = كل الأصناف */
  supplierIds?: string[];
  userId?: string | null;
  active?: boolean;
  note?: string;
}

/** فاتورة شراء في التصفية الثابتة: الكمية × المبلغ للوحدة = المستحق. */
export interface FixedInvoice {
  id: string;
  selected: boolean;
  invoiceNo: string;
  date: string;
  supplierName: string;
  currency: 'EGP' | 'USD';
  /** مجموع كميات أصناف المورد في الفاتورة */
  qty: number;
  /** المبلغ للوحدة. `null` = مكتوبش بعد، فالمستحق مش محسوب. */
  rate: number | null;
  amount: number | null;
  note: string | null;
  itemCount: number;
  items: { id: string; productName: string; unit: string | null; qty: number }[];
}

/** حركة إضافة أو نقص على رأس المال القديم. المبلغ الموجب إضافة والسالب نقص. */
export interface CapitalMovement {
  id: string;
  date: string;
  amount: number;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface CapitalState {
  /** رأس المال المكتوب في الإعدادات */
  opening: number;
  /** مجموع الإضافات والنقص */
  movements: number;
  current: number;
  entries: CapitalMovement[];
}

export interface CapitalMovementInput {
  date: string;
  amount: number;
  note?: string;
}

/**
 * سطر في كشف الحساب: مستحق من فاتورة (`DUE`) أو دفعة تسلّمها (`PAYMENT`
 * بمبلغ سالب)، ومن أين جاء، والرصيد التراكمي.
 */
export interface StatementEntry {
  /** uid الدفعة — `null` في سطر المستحق */
  id: string | null;
  kind: 'DUE' | 'PAYMENT';
  date: string;
  label: string;
  source: string;
  amount: number;
  balance: number;
}

export interface Statement {
  partner: Partner;
  /** إجمالي المستحق من الفواتير المحسوبة */
  dues: number;
  /** إجمالي ما تسلّمه */
  paid: number;
  /** المتبقي له = المستحق − المدفوع */
  total: number;
  entries: StatementEntry[];
}

/** دفعة تسلّمها الاسم من مستحقه. */
export interface PartnerPayment {
  id: string;
  date: string;
  amount: number;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface PaymentsState {
  total: number;
  entries: PartnerPayment[];
}

export interface PaymentInput {
  date: string;
  amount: number;
  note?: string;
}
