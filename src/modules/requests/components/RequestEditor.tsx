'use client';

import { useState } from 'react';
import { todayISO } from '@/lib/format';
import { useNavigationGuard } from '@/lib/useNavigationGuard';
import { fieldNavKeyDown } from '@/lib/field-nav';
import { PageTitle, Field, MoneyInput } from '@/components/common';
import { PartyCombobox } from '../../invoices/components/PartyCombobox';
import { useAllParties } from '../../parties/hooks';
import { useAllProducts } from '../../products/hooks';
import { ProductCombobox } from '../../products/components/ProductCombobox';
import { useCreateRequest } from '../hooks';
import type { RequestItem } from '../dtos';

const blank = (): RequestItem => ({ name: '', qty: 0 });

export function RequestEditor({ onClose }: { onClose: () => void }) {
  const { data: clients } = useAllParties('CLIENT');
  const { data: products } = useAllProducts();
  const createRequest = useCreateRequest();

  const [date, setDate] = useState(todayISO());
  const [clientId, setClientId] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<RequestItem[]>([blank()]);
  const [error, setError] = useState('');

  const isDirty = !!(clientId || items.some((it) => !!(it.name || it.qty)));
  useNavigationGuard(isDirty);
  const handleClose = () => {
    if (isDirty && !window.confirm('في بيانات لم تُحفظ — هل تريد المغادرة بدون حفظ؟')) return;
    onClose();
  };

  const setItem = (i: number, patch: Partial<RequestItem>) =>
    setItems((its) => its.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const save = () => {
    setError('');
    const goods = items.filter((it) => it.name.trim() && it.qty > 0);
    if (!clientId) return setError('اختر العميل');
    if (goods.length === 0) return setError('أضف صنفًا واحدًا على الأقل');
    createRequest.mutate(
      { date, clientId, note: note.trim() || undefined, items: goods.map((it) => ({ name: it.name.trim(), qty: Number(it.qty) || 0 })) },
      { onSuccess: onClose, onError: (e: any) => setError(e.message) },
    );
  };

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={handleClose}>→ رجوع لقائمة الطلبيات</button>
      <PageTitle title="طلبية جديدة" subtitle="طلبية باسم العميل — تسجّل الوارد لاحقًا" />
      <div className="card" onKeyDown={fieldNavKeyDown}>
        <div className="form-grid">
          <Field label="لمين (العميل)">
            <PartyCombobox parties={clients?.data ?? []} value={clientId} onChange={setClientId} role="CLIENT" />
          </Field>
          <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="ملاحظات (اختياري)" full><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>

        <div className="tbl-wrap combo-table">
          <table>
            <thead><tr><th>الصنف</th><th>الكمية المطلوبة</th><th></th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td style={{ minWidth: 240 }}>
                    <ProductCombobox products={products?.data ?? []} value={it.name} onChange={(name) => setItem(i, { name })} freeText />
                  </td>
                  <td><MoneyInput value={String(it.qty || '')} onChange={(v) => setItem(i, { qty: Number(v) || 0 })} placeholder="0" style={{ width: 100 }} /></td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => setItems((its) => its.filter((_, idx) => idx !== i))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setItems((its) => [...its, blank()])}>+ إضافة صنف</button>
        </div>

        <div className="err-text" style={{ padding: '0 16px' }}>{error}</div>
        <div className="toolbar" style={{ padding: 16 }}>
          <button className="btn btn-primary" onClick={save} disabled={createRequest.isPending}>{createRequest.isPending ? '...' : 'حفظ الطلب'}</button>
          <button className="btn btn-ghost" onClick={handleClose}>إلغاء</button>
        </div>
      </div>
    </>
  );
}
