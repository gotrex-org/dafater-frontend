'use client';

import { useState } from 'react';
import { QTY, fmtDate, todayISO } from '@/lib/format';
import { Field, Combobox, DataTable, type Column } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useWarehouseStock } from '../../warehouses/hooks';
import { useAdjustments, useCreateAdjustment, useDeleteAdjustment } from '../hooks';
import type { Adjustment } from '../dtos';
import type { StockRow } from '../../warehouses/dtos';

export function StockAdjustment({ warehouseId }: { warehouseId: string }) {
  const { user } = useAuth();
  const { data: stockRows = [] } = useWarehouseStock(warehouseId);
  const { data: adjData, isLoading } = useAdjustments(warehouseId);
  const createAdj = useCreateAdjustment();
  const deleteAdj = useDeleteAdjustment(warehouseId);

  const [productId, setProductId] = useState('');
  const [mode, setMode] = useState<'actual' | 'delta'>('actual');
  const [actualQty, setActualQty] = useState('');
  const [deltaQty, setDeltaQty] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const selectedRow = stockRows.find((r) => r.productId === productId);
  const currentQty = selectedRow?.qty ?? 0;

  const computedDelta = mode === 'actual'
    ? (actualQty !== '' ? Number(actualQty) - currentQty : null)
    : (deltaQty !== '' ? Number(deltaQty) : null);

  const reset = () => {
    setProductId(''); setActualQty(''); setDeltaQty(''); setNote(''); setErr('');
  };

  const save = () => {
    setErr('');
    if (!productId) return setErr('اختر الصنف');
    if (computedDelta === null || isNaN(computedDelta)) return setErr('اكتب الكمية');
    if (computedDelta === 0) return setErr('لا يوجد فرق في الكمية');
    createAdj.mutate(
      { date, warehouseId, productId, qty: computedDelta, note: note.trim() || undefined },
      { onSuccess: reset, onError: (e: any) => setErr(e.message) },
    );
  };

  const adjustments = adjData?.data ?? [];

  const cols: Column<Adjustment>[] = [
    { header: 'التاريخ', cell: (r) => fmtDate(r.date), className: 'muted' },
    { header: 'الصنف', cell: (r) => r.product.name },
    {
      header: 'الكمية',
      cell: (r) => (
        <span className={r.qty > 0 ? 'cre' : 'deb'}>
          {r.qty > 0 ? '+' : ''}{QTY(r.qty)}
        </span>
      ),
      className: 'num',
    },
    { header: 'البيان', cell: (r) => r.note || '—', className: 'muted' },
    {
      header: '',
      cell: (r) => user?.admin ? (
        <button
          className="btn btn-danger btn-sm"
          style={{ fontSize: 11, padding: '2px 8px' }}
          onClick={(e) => {
            e.stopPropagation();
            if (!window.confirm('حذف التسوية؟')) return;
            deleteAdj.mutate(r.uid);
          }}
        >حذف</button>
      ) : null,
    },
  ];

  const productOptions = stockRows.map((r) => ({ id: r.productId, name: r.name }));

  return (
    <div>
      {/* Form */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <b style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>تسوية جديدة</b>

        <div className="toolbar" style={{ marginBottom: 12 }}>
          <button
            className={`btn btn-sm ${mode === 'actual' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMode('actual')}
          >كمية فعلية</button>
          <button
            className={`btn btn-sm ${mode === 'delta' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMode('delta')}
          >تعديل مباشر (+/-)</button>
        </div>

        <div className="form-grid">
          <Field label="التاريخ">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="الصنف">
            <Combobox
              options={productOptions}
              value={productId}
              onChange={(v) => { setProductId(v); setActualQty(''); setDeltaQty(''); }}
              placeholder="اختر الصنف…"
            />
          </Field>

          {productId && (
            <Field label="الرصيد الحالي">
              <div style={{ padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
                {QTY(currentQty)} {selectedRow?.unit || ''}
              </div>
            </Field>
          )}

          {mode === 'actual' ? (
            <Field label="الكمية الفعلية (جرد)">
              <input
                type="number"
                value={actualQty}
                onChange={(e) => setActualQty(e.target.value)}
                placeholder="0"
                min="0"
              />
            </Field>
          ) : (
            <Field label="التعديل (+ زيادة / - نقص)">
              <input
                type="number"
                value={deltaQty}
                onChange={(e) => setDeltaQty(e.target.value)}
                placeholder="مثال: 5 أو -3"
              />
            </Field>
          )}

          {computedDelta !== null && computedDelta !== 0 && (
            <Field label="الفرق">
              <div style={{
                padding: '10px 12px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                background: computedDelta > 0 ? 'var(--credit-bg)' : 'var(--debit-bg)',
                color: computedDelta > 0 ? 'var(--credit)' : 'var(--debit)',
              }}>
                {computedDelta > 0 ? '+' : ''}{QTY(computedDelta)}
              </div>
            </Field>
          )}

          <Field label="البيان" full>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="سبب التسوية (اختياري)…" />
          </Field>
        </div>

        {err && <div className="err-text" style={{ marginTop: 8 }}>{err}</div>}
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={createAdj.isPending}>
            {createAdj.isPending ? '...' : 'تسجيل التسوية'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={reset}>مسح</button>
        </div>
      </div>

      {/* History */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>سجل التسويات</div>
        <DataTable
          columns={cols}
          rows={adjustments}
          rowKey={(r) => r.uid}
          loading={isLoading}
          emptyText="لا توجد تسويات لهذا المخزن"
        />
      </div>
    </div>
  );
}
