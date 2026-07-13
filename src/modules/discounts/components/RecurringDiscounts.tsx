'use client';

import { useState } from 'react';
import { EGP, fmtDate, todayISO } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { Field, MoneyInput, Spinner } from '@/components/common';
import { useAllParties } from '../../parties/hooks';
import { PartyCombobox } from '../../invoices/components/PartyCombobox';
import { useDiscountSchedules, useCreateDiscountSchedule, useDeleteDiscountSchedule } from '../hooks';
import { DISCOUNT_RECURRENCE_LABEL, type DiscountRecurrence } from '../dtos';

const RECS: DiscountRecurrence[] = ['MONTHLY', 'QUARTERLY', 'YEARLY'];

export function RecurringDiscounts() {
  const { can } = useAuth();
  const { data: clients } = useAllParties('CLIENT');
  const { data: suppliers } = useAllParties('SUPPLIER');
  const allParties = [...(clients?.data ?? []), ...(suppliers?.data ?? [])];

  const { data: schedules, isLoading } = useDiscountSchedules();
  const createS = useCreateDiscountSchedule();
  const deleteS = useDeleteDiscountSchedule();

  const [adding, setAdding] = useState(false);
  const [partyId, setPartyId] = useState('');
  const [recurrence, setRecurrence] = useState<DiscountRecurrence>('MONTHLY');
  const [startDate, setStartDate] = useState(todayISO());
  const [mode, setMode] = useState<'amount' | 'percent'>('amount');
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const reset = () => { setPartyId(''); setAmount(''); setPercent(''); setNote(''); setError(''); setAdding(false); };

  const save = () => {
    setError('');
    if (!partyId) return setError('اختر الشركة/الطرف');
    if (mode === 'amount' && !(Number(amount) > 0)) return setError('اكتب مبلغ الخصم');
    if (mode === 'percent' && !(Number(percent) > 0)) return setError('اكتب نسبة الخصم %');
    createS.mutate(
      {
        partyId, recurrence, startDate,
        amount: mode === 'amount' ? Number(amount) : undefined,
        percent: mode === 'percent' ? Number(percent) : undefined,
        note: note.trim() || undefined,
      },
      { onSuccess: reset, onError: (e: any) => setError(e.message) },
    );
  };

  return (
    <>
      <div className="toolbar">
        {can('invoices') && <button className="btn btn-primary btn-sm sp" onClick={() => setAdding((v) => !v)}>{adding ? '× إلغاء' : '+ خصم دوري'}</button>}
      </div>

      {adding && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>خصم دوري للشركات (بيتخصم أوتوماتيك في ميعاده)</div>
          <div className="form-grid">
            <Field label="الشركة / الطرف"><PartyCombobox parties={allParties} value={partyId} onChange={setPartyId} role="SUPPLIER" /></Field>
            <Field label="التكرار">
              <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as DiscountRecurrence)} style={{ width: '100%' }}>
                {RECS.map((r) => <option key={r} value={r}>{DISCOUNT_RECURRENCE_LABEL[r]}</option>)}
              </select>
            </Field>
            <Field label="أول ميعاد"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="نوع الخصم">
              <select value={mode} onChange={(e) => setMode(e.target.value as 'amount' | 'percent')} style={{ width: '100%' }}>
                <option value="amount">مبلغ ثابت</option>
                <option value="percent">نسبة % من المشتريات</option>
              </select>
            </Field>
            {mode === 'amount'
              ? <Field label="مبلغ الخصم"><MoneyInput value={amount} onChange={setAmount} placeholder="0.00" /></Field>
              : <Field label="النسبة %"><MoneyInput value={percent} onChange={setPercent} placeholder="مثلاً 5" /></Field>}
            <Field label="البيان (اختياري)" full><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="خصم شهري…" /></Field>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>النسبة بتتحسب على صافي مشترياتك من الطرف خلال الفترة السابقة للميعاد.</div>
          {error && <div className="err-text">{error}</div>}
          <div className="toolbar" style={{ marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={createS.isPending}>حفظ الخصم الدوري</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>إلغاء</button>
          </div>
        </div>
      )}

      {isLoading ? <Spinner /> : !schedules?.length ? <div className="empty">لا توجد خصومات دورية</div> : (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>الطرف</th><th>التكرار</th><th>القيمة</th><th>أول ميعاد</th><th>آخر تطبيق</th><th></th></tr></thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.party?.name}</b> {s.party?.role === 'SUPPLIER' ? <span className="pill">مورد</span> : <span className="pill">عميل</span>}</td>
                  <td>{DISCOUNT_RECURRENCE_LABEL[s.recurrence]}</td>
                  <td className="num">{s.percent > 0 ? `${s.percent}%` : EGP(s.amount)}</td>
                  <td>{fmtDate(s.startDate)}</td>
                  <td className="muted">{s.lastApplied ? fmtDate(s.lastApplied) : '—'}</td>
                  <td>{can('invoices.delete') && <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('حذف الخصم الدوري؟ (الخصومات اللي اتطبّقت قبل كده بتفضل)')) deleteS.mutate(s.id); }}>حذف</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
