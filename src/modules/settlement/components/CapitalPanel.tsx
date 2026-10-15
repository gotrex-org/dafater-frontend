'use client';

import { useState } from 'react';
import { EGP, fmtDate, todayISO } from '@/lib/format';
import { Field, MoneyInput, Spinner, StatCard, StatsGrid } from '@/components/common';
import { useAddCapitalMovement, useCapital, useDeleteCapitalMovement } from '../hooks';
import type { Partner } from '../dtos';

/**
 * إضافة أو نقص رأس المال على القديم. رأس المال المكتوب في الإعدادات هو
 * الافتتاحي، وكل إضافة أو نقص حركة بتاريخها تبقى في السجل — فالرصيد الحالي
 * معروف، ومعروف كذلك كيف وصل إليه.
 */
export function CapitalPanel({ partner }: { partner: Partner }) {
  const { data, isLoading } = useCapital(partner.id);
  const del = useDeleteCapitalMovement(partner.id);
  const [adding, setAdding] = useState(false);

  if (isLoading || !data) return <Spinner />;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <b style={{ display: 'block', marginBottom: 10 }}>رأس مال {partner.name}</b>

      <StatsGrid columns={3}>
        <StatCard label="رأس المال الافتتاحي" value={EGP(data.opening)} />
        <StatCard
          label="إضافات ونقص"
          value={EGP(data.movements)}
          variant={data.movements < 0 ? 'debit' : 'gold'}
        />
        <StatCard label="رأس المال الحالي" value={EGP(data.current)} variant="accent" />
      </StatsGrid>

      <div className="muted" style={{ fontSize: 12, margin: '6px 2px 10px' }}>
        رأس المال الحالي = الافتتاحي + الإضافات − النقص. نسبة {partner.name} في كل فاتورة تُحسب
        برأس ماله في <b>تاريخ تلك الفاتورة</b>، فالإضافة أو النقص لا يعيد حساب فاتورة سابقة لتاريخها.
      </div>

      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={() => setAdding((a) => !a)}>
          {adding ? 'إلغاء' : '+ إضافة أو نقص'}
        </button>
      </div>

      {adding && <MovementForm partner={partner} onDone={() => setAdding(false)} />}

      {!data.entries.length ? (
        <div className="muted" style={{ fontSize: 13 }}>
          لا توجد إضافات أو نقص على رأس المال.
        </div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th className="num">المبلغ</th>
                <th>ملاحظة</th>
                <th>أضافه</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((m) => (
                <tr key={m.id}>
                  <td>{fmtDate(m.date)}</td>
                  <td className="num" style={{ color: m.amount < 0 ? 'var(--debit)' : 'var(--credit)' }}>
                    <b>{m.amount > 0 ? `+${EGP(m.amount)}` : EGP(m.amount)}</b>
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{m.note || '—'}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{m.createdByName || '—'}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={del.isPending}
                      onClick={() => {
                        if (window.confirm('حذف هذه الحركة من رأس المال؟')) del.mutate(m.id);
                      }}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** المبلغ موجب للإضافة وسالب للنقص — الاختيار هنا، ولا يُكتب بعلامة يدوياً. */
function MovementForm({ partner, onDone }: { partner: Partner; onDone: () => void }) {
  const add = useAddCapitalMovement(partner.id);
  const [date, setDate] = useState(todayISO());
  const [kind, setKind] = useState<'add' | 'sub'>('add');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (!date) return setError('حدد التاريخ');
    const value = Number(amount);
    if (!(value > 0)) return setError('اكتب المبلغ');
    setError('');
    add.mutate(
      { date, amount: kind === 'sub' ? -value : value, note: note || undefined },
      { onSuccess: onDone, onError: (e: any) => setError(e.message) },
    );
  };

  return (
    <div
      className="card"
      style={{ padding: 16, marginBottom: 12, background: 'var(--surface-2, transparent)' }}
    >
      <div className="form-grid">
        <Field label="التاريخ">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="النوع">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'add' | 'sub')}
            style={{
              width: '100%', padding: '11px 12px', border: '1.5px solid var(--line)',
              borderRadius: 10, background: 'var(--surface)', fontSize: 14,
            }}
          >
            <option value="add">إضافة لرأس المال</option>
            <option value="sub">نقص من رأس المال</option>
          </select>
        </Field>
        <Field label="المبلغ (ج.م)">
          <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
        </Field>
        <Field label="ملاحظة">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" />
        </Field>
      </div>

      {error && <div className="err-text" style={{ marginTop: 8 }}>{error}</div>}

      <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
        <button className="btn btn-primary" disabled={add.isPending} onClick={submit}>
          {add.isPending ? '...' : 'حفظ الحركة'}
        </button>
        <button className="btn btn-ghost" onClick={onDone}>إلغاء</button>
      </div>
    </div>
  );
}
