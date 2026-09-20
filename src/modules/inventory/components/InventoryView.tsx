'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EGP, QTY } from '@/lib/format';
import type { PageMeta } from '@/lib/types';
import { PageTitle, DataTable, StatsGrid, StatCard, SearchInput, Combobox, MoneyInput, type Column } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useAllWarehouses, useWarehouseStock, useCreateWarehouse, warehouseKeys } from '../../warehouses/hooks';
import type { StockRow } from '../../warehouses/dtos';
import { useUpdateProduct } from '../../products/hooks';
import { ProductMovements } from './ProductMovements';
import { LoansView } from '../../loans/components/LoansView';
import { StockAdjustment } from '../../adjustments/components/StockAdjustment';
import { StockTransfer } from '../../adjustments/components/StockTransfer';
import { WarehouseStockPrint } from './WarehouseStockPrint';

/**
 * اسم الصنف بيتعدّل من مكانه في شاشة المخازن — دوسة على الاسم تفتحه للكتابة،
 * Enter يحفظ و Esc يلغي. الاسم متخزّن على الصنف نفسه فبيتغيّر في كل المخازن
 * والفواتير القديمة كمان (الفواتير بتشاور على الصنف، مش بتنسخ اسمه).
 * الدوسة مابتفتحش كارت الصنف — السطر كله قابل للضغط، فبنوقف الحدث هنا.
 */
function NameCell({ row, canEdit }: { row: StockRow; canEdit: boolean }) {
  const qc = useQueryClient();
  const updateProduct = useUpdateProduct();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(row.name);
  const [err, setErr] = useState('');

  if (!canEdit) return <>{row.name}</>;

  const save = () => {
    const name = val.trim();
    if (!name) return setErr('اكتب الاسم');
    if (name === row.name) { setEditing(false); setErr(''); return; }
    updateProduct.mutate(
      { id: row.productId, dto: { name } },
      {
        onSuccess: () => { qc.invalidateQueries({ queryKey: warehouseKeys.all }); setEditing(false); setErr(''); },
        onError: (e: any) => setErr(e.message ?? 'حدث خطأ'),
      },
    );
  };

  if (editing) {
    return (
      <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') { setVal(row.name); setErr(''); setEditing(false); }
          }}
          style={{ width: 190, padding: '4px 8px', border: '1.5px solid var(--accent)', borderRadius: 7, fontSize: 13 }}
        />
        <button className="btn btn-primary btn-sm" style={{ padding: '2px 8px' }} onClick={save} disabled={updateProduct.isPending}>✓</button>
        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => { setVal(row.name); setErr(''); setEditing(false); }}>×</button>
        {err && <span className="err-text" style={{ fontSize: 11 }}>{err}</span>}
      </span>
    );
  }

  return (
    <span
      title="اضغط لتعديل اسم الصنف"
      style={{ cursor: 'text', borderBottom: '1px dashed var(--line)' }}
      onClick={(e) => { e.stopPropagation(); setVal(row.name); setEditing(true); }}
    >
      {row.name}
    </span>
  );
}

/**
 * خانة سعر بتتعدّل في مكانها من شاشة المخازن. `field` بيحدد السعر اللي على الصنف:
 *   price         = سعر التقييم (بيقيّم المخزون)
 *   purchasePrice = سعر الشراء الثابت — بيتحط تلقائيًا في سطر فاتورة الشراء
 *   salePrice     = سعر البيع الثابت — بيتحط تلقائيًا في سطر فاتورة البيع
 * التلاتة بيتخزنوا على الصنف نفسه، فالتعديل من هنا بيبان في كل المخازن والفواتير
 * الجديدة على طول. تعديل السعر جوّه فاتورة بيخص الفاتورة دي بس ومابيرجعش هنا.
 */
function PriceCell({
  row, canEdit, field, hint,
}: {
  row: StockRow;
  canEdit: boolean;
  field: 'price' | 'purchasePrice' | 'salePrice';
  hint: string;
}) {
  const qc = useQueryClient();
  const updateProduct = useUpdateProduct();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const current = field === 'price' ? row.cost : (row[field] ?? 0);
  // 0 في سعر ثابت معناها «مش متسجّل» — شرطة أوضح من ٠٫٠٠
  const shown = field !== 'price' && !current ? <span className="muted">—</span> : <>{EGP(current)}</>;

  if (!canEdit) return shown;

  if (!editing) {
    return (
      <span
        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
        title={hint}
        onClick={(e) => { e.stopPropagation(); setVal(String(current || '')); setEditing(true); }}
      >
        {shown}
        <span style={{ opacity: 0.5, fontSize: 12 }}>✏</span>
      </span>
    );
  }

  const save = () => {
    updateProduct.mutate(
      { id: row.productId, dto: { [field]: Number(val) || 0 } },
      { onSuccess: () => { qc.invalidateQueries({ queryKey: warehouseKeys.all }); setEditing(false); } },
    );
  };

  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <MoneyInput
        value={val}
        onChange={setVal}
        placeholder="0"
        style={{ width: 90 }}
        autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      />
      <button className="btn btn-primary btn-sm" style={{ padding: '2px 8px' }} onClick={save} disabled={updateProduct.isPending}>✓</button>
      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => setEditing(false)}>×</button>
    </span>
  );
}

export function InventoryView() {
  const { user, can } = useAuth();
  const canLoans = can('inventory.loans');
  const canEditPrice = !!user?.admin || can('settings');
  const [view, setView] = useState<'stock' | 'loans' | 'adjust' | 'transfer'>('stock');
  const [prod, setProd] = useState<StockRow | null>(null);
  const [printing, setPrinting] = useState(false);
  const { data: warehouses } = useAllWarehouses();
  const canAddWarehouse = can('inventory.addWarehouse');
  const createWarehouse = useCreateWarehouse();
  const [whId, setWhId] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'name' | 'qtyDesc' | 'qtyAsc' | 'valueDesc' | 'costDesc'>('name');
  const [addingWh, setAddingWh] = useState(false);
  const [whName, setWhName] = useState('');
  const [whErr, setWhErr] = useState('');

  const addWarehouse = () => {
    if (!whName.trim()) { setWhErr('اكتب اسم المخزن'); return; }
    setWhErr('');
    createWarehouse.mutate(
      { name: whName.trim() },
      { onSuccess: (w: any) => { setWhId(w?.id ?? whId); setWhName(''); setAddingWh(false); }, onError: (e: any) => setWhErr(e.message) },
    );
  };
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => { if (warehouses?.data[0] && !whId) setWhId(warehouses.data[0].id); }, [warehouses, whId]);
  useEffect(() => { setPage(1); }, [q, whId, pageSize, sort]);

  const { data: rows = [], isLoading } = useWarehouseStock(whId);

  const filtered = useMemo(() =>
    rows
      .filter((r) => r.name.includes(q) && (q.trim() ? true : r.qty !== 0))
      .sort((a, b) => {
        switch (sort) {
          case 'qtyDesc':   return b.qty - a.qty;
          case 'qtyAsc':    return a.qty - b.qty;
          case 'valueDesc': return b.value - a.value;
          case 'costDesc':  return (b.cost || 0) - (a.cost || 0);
          default:          return a.name.localeCompare(b.name, 'ar');
        }
      }),
  [rows, q, sort]);
  const totalValue = filtered.reduce((s, r) => s + r.value, 0);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const meta: PageMeta = { total, page, pageSize, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };

  if (printing) {
    const whName = warehouses?.data.find((w) => w.id === whId)?.name ?? '';
    return <WarehouseStockPrint warehouseId={whId} warehouseName={whName} onClose={() => setPrinting(false)} />;
  }

  const columns: Column<StockRow>[] = [
    { header: 'الصنف', cell: (r) => <NameCell row={r} canEdit={canEditPrice} /> },
    { header: 'الرصيد', cell: (r) => <span className={r.qty < 0 ? 'deb' : ''}>{QTY(r.qty)} {r.unit || ''}</span>, className: 'num' },
    { header: 'سعر الشراء', cell: (r) => <PriceCell row={r} canEdit={canEditPrice} field="purchasePrice" hint="سعر الشراء الثابت — بيتحط تلقائيًا في سطر فاتورة الشراء، وقابل للتعديل على الفاتورة" />, className: 'num' },
    { header: 'سعر البيع', cell: (r) => <PriceCell row={r} canEdit={canEditPrice} field="salePrice" hint="سعر البيع الثابت — بيتحط تلقائيًا في سطر فاتورة البيع، وقابل للتعديل على الفاتورة" />, className: 'num' },
    { header: 'سعر التقييم', cell: (r) => <PriceCell row={r} canEdit={canEditPrice} field="price" hint="سعر تقييم المخزون — بيتحسب من متوسط الشراء لو مش محطوط يدوي" />, className: 'num muted' },
    { header: 'القيمة', cell: (r) => EGP(r.value), className: 'num' },
  ];

  return (
    <>
      <PageTitle title="المخازن" subtitle="رصيد البضاعة في كل مخزن وقيمتها — واضغط على أي سعر عشان تعدّله" />

      {/* view switcher */}
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`btn btn-sm ${view === 'stock' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('stock')}>الرصيد</button>
          {canLoans && (
            <button className={`btn btn-sm ${view === 'loans' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('loans')}>البضاعة المعارة</button>
          )}
          <button className={`btn btn-sm ${view === 'adjust' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('adjust')}>تسوية المخزن</button>
          <button className={`btn btn-sm ${view === 'transfer' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('transfer')}>تحويل بين المخازن</button>
        </div>
      </div>

      {view === 'transfer' && <div style={{ marginTop: 16 }}><StockTransfer defaultFrom={whId} /></div>}

      {view === 'adjust' && (
        <div style={{ marginTop: 16 }}>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <div style={{ minWidth: 200 }}><Combobox options={warehouses?.data ?? []} value={whId} onChange={setWhId} placeholder="المخزن" /></div>
          </div>
          {whId && <StockAdjustment warehouseId={whId} />}
        </div>
      )}

      {view === 'loans' && canLoans ? (
        <div style={{ marginTop: 16 }}>
          <LoansView defaultWarehouseId={whId} />
        </div>
      ) : (view !== 'adjust' && view !== 'transfer') && (
        <>
          <div className="toolbar">
            <div style={{ minWidth: 200 }}><Combobox options={warehouses?.data ?? []} value={whId} onChange={setWhId} placeholder="المخزن" /></div>
            <div style={{ minWidth: 220 }}>
              <Combobox options={rows.map((r) => ({ id: r.productId, name: r.name }))} value="" onChange={(id) => { const r = rows.find((x) => x.productId === id); if (r) setProd(r); }} placeholder="اكتب واختر صنف…" />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={{ padding: '10px 12px', border: '1.5px solid var(--line)', borderRadius: 10 }} title="ترتيب العرض">
              <option value="name">ترتيب: أبجدي</option>
              <option value="qtyDesc">ترتيب: الأكثر رصيدًا</option>
              <option value="qtyAsc">ترتيب: الأقل رصيدًا</option>
              <option value="valueDesc">ترتيب: الأعلى قيمة</option>
              <option value="costDesc">ترتيب: الأعلى سعرًا</option>
            </select>
            {canAddWarehouse && !addingWh && (
              <button className="btn btn-ghost btn-sm" onClick={() => setAddingWh(true)}>+ مخزن جديد</button>
            )}
            {whId && <button className="btn btn-ghost btn-sm sp" onClick={() => setPrinting(true)}>🖨 طباعة رصيد المخزن</button>}
          </div>
          {canAddWarehouse && addingWh && (
            <div className="toolbar" style={{ gap: 6 }}>
              <input
                autoFocus placeholder="اسم المخزن" value={whName}
                onChange={(e) => setWhName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addWarehouse(); if (e.key === 'Escape') setAddingWh(false); }}
                style={{ padding: '10px 12px', border: '1.5px solid var(--line)', borderRadius: 10 }}
              />
              <button className="btn btn-primary btn-sm" onClick={addWarehouse} disabled={createWarehouse.isPending}>{createWarehouse.isPending ? '...' : 'حفظ'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setAddingWh(false); setWhName(''); setWhErr(''); }}>إلغاء</button>
              {whErr && <span className="err-text">{whErr}</span>}
            </div>
          )}
          <StatsGrid columns={2}>
            <StatCard variant="gold" label="قيمة المخزن (المعروض)" value={EGP(totalValue)} />
            <StatCard label="عدد الأصناف" value={filtered.filter((r) => r.qty !== 0).length} />
          </StatsGrid>
          <div className="section">
            <DataTable
              columns={columns}
              rows={pageRows}
              rowKey={(r) => r.productId}
              onRowClick={setProd}
              loading={isLoading}
              emptyText="لا توجد أصناف"
              meta={meta}
              onPage={setPage}
              pageSize={pageSize}
              onPageSize={setPageSize}
            />
          </div>
        </>
      )}

      {prod && (
        <div className="modal-overlay" onClick={() => setProd(null)}>
          <div className="modal" style={{ width: '94%', maxWidth: 920, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 16 }}>
              <ProductMovements productId={prod.productId} name={prod.name} onBack={() => setProd(null)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
