'use client';

import { useState } from 'react';
import { QTY, todayISO } from '@/lib/format';
import { Field, Combobox, MoneyInput } from '@/components/common';
import { useAllWarehouses, useWarehouseStock } from '../../warehouses/hooks';
import { useAllProducts } from '../../products/hooks';
import { ProductCombobox } from '../../products/components/ProductCombobox';
import { useTransferStock } from '../hooks';

interface Line { _k: number; productId: string; qty: string; }
let _k = 0;
const blank = (): Line => ({ _k: _k++, productId: '', qty: '' });

export function StockTransfer({ defaultFrom }: { defaultFrom?: string }) {
  const { data: warehouses } = useAllWarehouses();
  const { data: products } = useAllProducts();
  const [from, setFrom] = useState(defaultFrom ?? '');
  const [to, setTo] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const { data: stock } = useWarehouseStock(from || undefined);
  const stockBy = new Map((stock ?? []).map((r) => [r.productId, r]));
  const transfer = useTransferStock();
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const save = () => {
    setError(''); setMsg('');
    if (!from) return setError('اختر المخزن المصدر');
    if (!to) return setError('اختر المخزن المستلم');
    if (from === to) return setError('اختر مخزنين مختلفين');
    const items = lines.filter((l) => l.productId && Number(l.qty) > 0).map((l) => ({ productId: l.productId, qty: Number(l.qty) }));
    if (!items.length) return setError('أضف صنفًا واحدًا على الأقل بكمية صحيحة');
    transfer.mutate(
      { date, fromWarehouseId: from, toWarehouseId: to, items, note: note.trim() || undefined },
      { onSuccess: () => { setMsg('تم التحويل بين المخازن ✓'); setLines([blank()]); }, onError: (e: any) => setError(e.message) },
    );
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>تحويل بضاعة بين المخازن (بيحرّك المخزن بس — مفيش أثر مالي)</div>
      <div className="form-grid">
        <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="من مخزن"><Combobox options={warehouses?.data ?? []} value={from} onChange={setFrom} /></Field>
        <Field label="إلى مخزن"><Combobox options={warehouses?.data ?? []} value={to} onChange={setTo} /></Field>
      </div>
      <div className="tbl-wrap combo-table">
        <table>
          <thead><tr><th>الصنف</th><th style={{ width: 120 }}>المتاح بالمصدر</th><th style={{ width: 110 }}>الكمية المحوّلة</th><th></th></tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const st = l.productId ? stockBy.get(l.productId) : undefined;
              return (
                <tr key={l._k}>
                  <td style={{ minWidth: 260 }}>
                    <ProductCombobox products={products?.data ?? []} value={l.productId} onChange={(id) => setLine(i, { productId: id })} />
                  </td>
                  <td className={`num ${(st?.qty ?? 0) < 0 ? 'deb' : 'muted'}`}>{from ? `${QTY(st?.qty ?? 0)} ${st?.unit || ''}` : '—'}</td>
                  <td><MoneyInput value={l.qty} onChange={(v) => setLine(i, { qty: v })} placeholder="0" style={{ width: 90 }} /></td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>×</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '8px 0' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setLines((ls) => [...ls, blank()])}>+ إضافة صنف</button>
      </div>
      <Field label="البيان (اختياري)" full><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {error && <div className="err-text">{error}</div>}
      {msg && <div style={{ color: 'var(--credit)', fontWeight: 700 }}>{msg}</div>}
      <div className="toolbar" style={{ marginTop: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={transfer.isPending}>{transfer.isPending ? '...' : 'تنفيذ التحويل'}</button>
      </div>
    </div>
  );
}
