'use client';

import { useState } from 'react';
import { EGP } from '@/lib/format';
import { Field, Combobox, MoneyInput } from '@/components/common';
import { useAllWarehouses } from '../../warehouses/hooks';
import { useWarehouseSchedules, useCreateWarehouseSchedule, useDeleteWarehouseSchedule } from '../hooks';

// بنود المخزن الثابتة (إيجار/مرتبات...) — كل شهر بتظهر كاستحقاق في التذكيرات، وما تتخصمش
// من الخزنة إلا لما حد يتأكّد إنها اتدفعت. خاصة بصاحب الحساب فقط.
export function WarehouseSchedulesManager() {
  const { data: schedules = [] } = useWarehouseSchedules();
  const { data: warehouses } = useAllWarehouses();
  const create = useCreateWarehouseSchedule();
  const del = useDeleteWarehouseSchedule();

  const [warehouseId, setWarehouseId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const submit = () => {
    setErr(''); setMsg('');
    if (!title.trim()) return setErr('اكتب اسم البند (إيجار / مرتبات...)');
    if (!amount || Number(amount) <= 0) return setErr('اكتب المبلغ');
    create.mutate(
      { warehouseId: warehouseId || undefined, title: title.trim(), amount: Number(amount), dayOfMonth: Number(dayOfMonth) || 1 },
      { onSuccess: () => { setMsg('تمت إضافة البند ✓'); setTitle(''); setAmount(''); }, onError: (e: any) => setErr(e.message) },
    );
  };

  const remove = (id: string, t: string) => {
    if (!window.confirm(`إيقاف بند "${t}" الثابت؟ الحركات اللي اتخصمت قبل كده هتفضل موجودة.`)) return;
    del.mutate(id);
  };

  return (
    <div className="section">
      <h2>بنود المخزن الثابتة <span className="muted" style={{ fontSize: 13 }}>(إيجار / مرتبات — تُخصم تلقائيًا كل شهر)</span></h2>
      <div className="card" style={{ padding: 14 }}>
        {schedules.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {schedules.map((s) => (
              <div key={s.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--line-soft)', paddingBottom: 8 }}>
                <span style={{ fontWeight: 700 }}>{s.title}</span>
                <span className="num" style={{ color: 'var(--debit)', fontWeight: 700 }}>{EGP(s.amount)}</span>
                <span className="muted" style={{ fontSize: 13 }}>{s.warehouse?.name ?? 'عام على الشركة'}</span>
                <span className="muted" style={{ fontSize: 12 }}>يوم {s.dayOfMonth} من كل شهر</span>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--debit)', marginInlineStart: 'auto' }} onClick={() => remove(s.id, s.title)} disabled={del.isPending}>× إيقاف</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>لا توجد بنود ثابتة بعد</div>
        )}

        <div className="form-grid">
          <Field label="المخزن (اختياري)"><Combobox options={warehouses?.data ?? []} value={warehouseId} onChange={setWarehouseId} placeholder="عام على الشركة" /></Field>
          <Field label="اسم البند"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="إيجار / مرتبات" /></Field>
          <Field label="المبلغ الشهري"><MoneyInput value={amount} onChange={setAmount} placeholder="0.00" /></Field>
          <Field label="يوم الاستحقاق من الشهر"><input type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} /></Field>
        </div>
        <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>البند بيظهر كل شهر في التذكيرات كاستحقاق — وما يتخصمش من الخزنة إلا لما حد يأكّد إنه اتدفع.</div>
        {err && <div className="err-text">{err}</div>}
        {msg && <div style={{ color: 'var(--credit)', fontWeight: 700 }}>{msg}</div>}
        <div className="toolbar" style={{ marginTop: 8, padding: 0 }}>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={create.isPending}>+ إضافة بند ثابت</button>
        </div>
      </div>
    </div>
  );
}
