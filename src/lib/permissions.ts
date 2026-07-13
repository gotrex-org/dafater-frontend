// Granular permission catalog: each page (parent "view" key) + its fine-grained
// actions. Stored on user.views as a flat string[]; checked with useAuth().can(key).

export interface PermGroup {
  page: string; // the page-level "view" key (lets the user open the page)
  label: string;
  actions: { key: string; label: string }[];
}

export const PERMISSIONS: PermGroup[] = [
  { page: 'dash', label: 'لوحة التحكم', actions: [] },
  {
    page: 'entry', label: 'الإدخال اليومي', actions: [
      { key: 'entry.collect',       label: 'تحصيل' },
      { key: 'entry.pay',           label: 'دفع لمورد' },
      { key: 'entry.expense',       label: 'مصروف' },
      { key: 'entry.transfer',      label: 'تحويل بين خزائن' },
      { key: 'entry.adjust',        label: 'تسوية مخزن' },
      { key: 'entry.unknown',       label: 'تحصيل مجهول' },
      { key: 'entry.resolve',       label: 'ترحيل المعلّق' },
      { key: 'entry.partyTransfer',   label: 'تحويل بين حسابات' },
      { key: 'entry.driverPayment',   label: 'دفع ناولون / عطلة سائق' },
      { key: 'entry.edit',            label: 'تعديل حركة' },
      { key: 'entry.delete',          label: 'حذف حركة' },
      { key: 'entry.ownOnly',         label: 'يشوف حركاته فقط (لا يشوف حركات الآخرين)' },
    ],
  },
  {
    page: 'invoices', label: 'الفواتير (شراء وبيع)', actions: [
      { key: 'invoices.createSale',      label: 'إنشاء فاتورة بيع' },
      { key: 'invoices.createPurchase',  label: 'إنشاء فاتورة شراء' },
      { key: 'invoices.edit',            label: 'تعديل فاتورة' },
      { key: 'invoices.delete',          label: 'حذف فاتورة' },
      { key: 'invoices.commission',      label: 'إضافة commission' },
      { key: 'invoices.registerProduct', label: 'تسجيل صنف جديد' },
    ],
  },
  {
    page: 'deals', label: 'البيع الخارجي', actions: [
      { key: 'deals.create', label: 'إنشاء' },
      { key: 'deals.edit',   label: 'تعديل' },
      { key: 'deals.delete', label: 'حذف' },
    ],
  },
  {
    page: 'manifests', label: 'كشوفات العربيات', actions: [
      { key: 'manifests.create',      label: 'إنشاء كشف عربية' },
      { key: 'manifests.edit',        label: 'تعديل كشف' },
      { key: 'manifests.delete',      label: 'حذف كشف' },
      { key: 'manifests.print',       label: 'طباعة' },
    ],
  },
  { page: 'driver-trips', label: 'كشف السائقين', actions: [] },
  {
    page: 'requests', label: 'طلبيات العملاء', actions: [
      { key: 'requests.create',  label: 'إنشاء طلبية' },
      { key: 'requests.receive', label: 'تسجيل وارد' },
      { key: 'requests.delete',  label: 'حذف' },
    ],
  },
  { page: 'ledger', label: 'كشف الحساب', actions: [] },
  {
    page: 'inventory', label: 'المخازن والمخزون', actions: [
      { key: 'inventory.addWarehouse', label: 'إضافة / تعديل مخزن' },
      { key: 'inventory.loans',        label: 'البضاعة المعارة (العاريات)' },
    ],
  },
  {
    page: 'treasury', label: 'الخزنة وحركة النقد', actions: [
      { key: 'treasury.settle',    label: 'إيداع / سحب من خزنة' },
      { key: 'treasury.movements', label: 'كل الحركات النقدية' },
      { key: 'treasury.expenses',  label: 'المصروفات حسب البند' },
      { key: 'treasury.add',       label: 'إضافة / تعديل خزنة' },
      { key: 'treasury.forex',     label: 'وسطاء الصرف' },
    ],
  },
  { page: 'today', label: 'تقرير اليوم', actions: [] },
  {
    page: 'settings', label: 'الإعدادات', actions: [
      { key: 'settings.users',   label: 'إدارة المستخدمين' },
      { key: 'settings.general', label: 'الإعدادات العامة' },
    ],
  },
  { page: 'audit', label: 'سجل النشاط', actions: [] },
  { page: 'reports', label: 'التقارير', actions: [] },
];
