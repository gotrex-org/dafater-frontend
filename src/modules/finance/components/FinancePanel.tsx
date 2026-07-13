'use client';

import { useState } from 'react';
import { EGP, fmtDate, todayISO } from '@/lib/format';
import { Field, MoneyInput, Spinner, StatsGrid, StatCard } from '@/components/common';
import { useFinance, useCreateOwnerEntry, useUpdateOwnerEntry, useDeleteOwnerEntry } from '../hooks';
import { OWNER_KIND_LABEL, type OwnerEntryKind, type OwnerEntry, type CreateOwnerEntryDto } from '../dtos';

const KINDS: OwnerEntryKind[] = ['PERSONAL_EXPENSE', 'COMPANY_PAYMENT', 'CLIENT_PAYMENT'];
const emptyForm = (): { kind: OwnerEntryKind; title: string; date: string; note: string } =>
  ({ kind: 'PERSONAL_EXPENSE', title: '', date: todayISO(), note: '' });

export function FinancePanel({ from, to }: { from?: string; to?: string }) {
  const { data, isLoading } = useFinance({ from, to });
  const createE = useCreateOwnerEntry();
  const updateE = useUpdateOwnerEntry();
  const deleteE = useDeleteOwnerEntry();

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [amountStr, setAmountStr] = useState('');
  const [discountStr, setDiscountStr] = useState('');
  const [error, setError] = useState('');
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const openNew = () => { setForm(emptyForm()); setAmountStr(''); setDiscountStr(''); setEditing('new'); setError(''); };
  const openEdit = (e: OwnerEntry) => {
    setForm({ kind: e.kind, title: e.title, date: e.date.slice(0, 10), note: e.note ?? '' });
    setAmountStr(String(e.amount || ''));
    setDiscountStr(e.discount ? String(e.discount) : '');
    setEditing(e.id);
    setError('');
  };

  const save = () => {
    setError('');
    if (!form.title.trim()) return setError('اكتب العنوان');
    if (!(Number(amountStr) > 0)) return setError('اكتب المبلغ');
    const dto: CreateOwnerEntryDto = {
      kind: form.kind, title: form.title.trim(), amount: Number(amountStr),
      discount: Number(discountStr) || undefined, date: form.date, note: form.note.trim() || undefined,
    };
    const done = () => setEditing(null);
    if (editing === 'new') createE.mutate(dto, { onSuccess: done, onError: (e: any) => setError(e.message) });
    else if (editing) updateE.mutate({ id: editing, dto }, { onSuccess: done, onError: (e: any) => setError(e.message) });
  };

  const totals = data?.totals;

  return (
    <>
      <div className="toolbar"><button className="btn btn-primary btn-sm sp" onClick={openNew}>+ بند جديد</button></div>

      {totals && (
        <StatsGrid columns={3}>
          {KINDS.map((k) => (
            <StatCard key={k} label={`${OWNER_KIND_LABEL[k]} (صافي)`} value={`${EGP(totals[k].net)} ج.م`} />
          ))}
        </StatsGrid>
      )}

      {editing && (
        <div className="card" style={{ padding: 16, margin: '12px 0' }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>{editing === 'new' ? 'بند جديد' : 'تعديل البند'}</div>
          <div className="form-grid">
            <Field label="النوع">
              <select value={form.kind} onChange={(e) => set({ kind: e.target.value as OwnerEntryKind })} style={{ width: '100%' }}>
                {KINDS.map((k) => <option key={k} value={k}>{OWNER_KIND_LABEL[k]}</option>)}
              </select>
            </Field>
            <Field label="التاريخ"><input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} /></Field>
            <Field label="العنوان" full><input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="مثلاً: إيجار / قسط شركة النقل" /></Field>
            <Field label="المبلغ"><MoneyInput value={amountStr} onChange={setAmountStr} placeholder="0.00" /></Field>
            <Field label="خصم (من الشركة — اختياري)"><MoneyInput value={discountStr} onChange={setDiscountStr} placeholder="0.00" /></Field>
            <Field label="ملاحظة (اختياري)" full><input value={form.note} onChange={(e) => set({ note: e.target.value })} /></Field>
          </div>
          {(Number(amountStr) > 0) && <div className="num muted" style={{ padding: '0 4px' }}>الصافي: {EGP(Number(amountStr) - (Number(discountStr) || 0))} ج.م</div>}
          {error && <div className="err-text">{error}</div>}
          <div className="toolbar" style={{ marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={createE.isPending || updateE.isPending}>حفظ</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>إلغاء</button>
          </div>
        </div>
      )}

      {isLoading ? <Spinner /> : !data?.entries.length ? <div className="empty">لا توجد بنود</div> : (
        <div className="tbl-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead><tr><th>التاريخ</th><th>النوع</th><th>العنوان</th><th style={{ width: 100 }}>المبلغ</th><th style={{ width: 90 }}>الخصم</th><th style={{ width: 100 }}>الصافي</th><th style={{ width: 90 }}></th></tr></thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.date)}</td>
                  <td><span className="pill">{OWNER_KIND_LABEL[e.kind]}</span></td>
                  <td><b>{e.title}</b>{e.note ? <span className="muted" style={{ fontSize: 12 }}> · {e.note}</span> : null}</td>
                  <td className="num">{EGP(e.amount)}</td>
                  <td className="num cre">{e.discount ? EGP(e.discount) : '—'}</td>
                  <td className="num"><b>{EGP(e.amount - e.discount)}</b></td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}>✏</button>
                    <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm(`حذف "${e.title}"؟`)) deleteE.mutate(e.id); }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
