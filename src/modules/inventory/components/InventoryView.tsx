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
import { WarehouseStockPrint } from './WarehouseStockPrint';

function CostCell({ row, canEdit }: { row: StockRow; canEdit: boolean }) {
  const qc = useQueryClient();
  const updateProduct = useUpdateProduct();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');

  if (!canEdit) return <>{EGP(row.cost)}</>;

  if (!editing) {
    return (
      <span
        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
        title="اضغط لتعديل سعر الصنف"
        onClick={(e) => { e.stopPropagation(); setVal(String(row.cost || '')); setEditing(true); }}
      >
        {EGP(row.cost)}
        <span style={{ opacity: 0.5, fontSize: 12 }}>✏</span>
      </span>
    );
  }

  const save = () => {
    updateProduct.mutate(
      { id: row.productId, dto: { price: Number(val) || 0 } },
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
  const [view, setView] = useState<'stock' | 'loans' | 'adjust'>('stock');
  const [prod, setProd] = useState<StockRow | null>(null);
  const [printing, setPrinting] = useState(false);
  const { data: warehouses } = useAllWarehouses();
  const canAddWarehouse = can('inventory.addWarehouse');
  const createWarehouse = useCreateWarehouse();
  const [whId, setWhId] = useState('');
  const [q, setQ] = useState('');
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
  useEffect(() => { setPage(1); }, [q, whId, pageSize]);

  const { data: rows = [], isLoading } = useWarehouseStock(whId);

  const filtered = useMemo(() =>
    rows
      .filter((r) => r.name.includes(q) && (q.trim() ? true : r.qty !== 0))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
  [rows, q]);
  const totalValue = filtered.reduce((s, r) => s + r.value, 0);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const meta: PageMeta = { total, page, pageSize, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };

  if (prod) return <ProductMovements productId={prod.productId} name={prod.name} onBack={() => setProd(null)} />;
  if (printing) {
    const whName = warehouses?.data.find((w) => w.id === whId)?.name ?? '';
    return <WarehouseStockPrint warehouseId={whId} warehouseName={whName} onClose={() => setPrinting(false)} />;
  }

  const columns: Column<StockRow>[] = [
    { header: 'الصنف', cell: (r) => r.name },
    { header: 'الرصيد', cell: (r) => <span className={r.qty < 0 ? 'deb' : ''}>{QTY(r.qty)} {r.unit || ''}</span>, className: 'num' },
    { header: 'سعر التقييم', cell: (r) => <CostCell row={r} canEdit={canEditPrice} />, className: 'num muted' },
    { header: 'القيمة', cell: (r) => EGP(r.value), className: 'num' },
  ];

  return (
    <>
      <PageTitle title="المخازن" subtitle="رصيد البضاعة في كل مخزن وقيمتها التقديرية" />

      {/* view switcher */}
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`btn btn-sm ${view === 'stock' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('stock')}>الرصيد</button>
          {canLoans && (
            <button className={`btn btn-sm ${view === 'loans' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('loans')}>البضاعة المعارة</button>
          )}
          <button className={`btn btn-sm ${view === 'adjust' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('adjust')}>تسوية المخزن</button>
        </div>
      </div>

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
      ) : view !== 'adjust' && (
        <>
          <div className="toolbar">
            <div style={{ minWidth: 200 }}><Combobox options={warehouses?.data ?? []} value={whId} onChange={setWhId} placeholder="المخزن" /></div>
            <div style={{ minWidth: 220 }}>
              <Combobox options={rows.map((r) => ({ id: r.productId, name: r.name }))} value="" onChange={(id) => { const r = rows.find((x) => x.productId === id); if (r) setProd(r); }} placeholder="اكتب واختر صنف…" />
            </div>
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
    </>
  );
}
