'use client';

import { useState } from 'react';
import { EGP, fmtDate, todayISO } from '@/lib/format';
import { PageTitle, Field, MoneyInput, Spinner } from '@/components/common';
import {
  useReminders, useCreateReminder, useUpdateReminder, useReminderDone, useReminderUndo, useDeleteReminder,
} from '../hooks';
import { REMINDER_KIND_LABEL, type Reminder, type ReminderKind, type ReminderRecurrence, type CreateReminderDto } from '../dtos';

const KINDS: ReminderKind[] = ['INSTALLMENT', 'COLLECT', 'PAY', 'APPOINTMENT', 'OTHER'];

const scheduleText = (r: Reminder | { recurrence: ReminderRecurrence; dayOfMonth?: number | null; date?: string | null }) =>
  r.recurrence === 'MONTHLY' ? `كل شهر يوم ${r.dayOfMonth ?? 1}` : r.date ? `بتاريخ ${fmtDate(r.date)}` : '—';

// Human timing for a due reminder based on days-to-target (negative = overdue).
const dueText = (d: number | null | undefined) =>
  d == null ? 'مستحق' : d > 0 ? `باقي ${d} يوم` : d === 0 ? 'مستحق اليوم' : `متأخّر ${-d} يوم`;

const emptyForm = (): CreateReminderDto => ({ title: '', kind: 'INSTALLMENT', amount: undefined, recurrence: 'MONTHLY', dayOfMonth: 1, date: undefined, note: '' });

export function RemindersView() {
  const { data: reminders, isLoading } = useReminders();
  const createR = useCreateReminder();
  const updateR = useUpdateReminder();
  const doneR = useReminderDone();
  const undoR = useReminderUndo();
  const deleteR = useDeleteReminder();

  const [editing, setEditing] = useState<string | null>(null); // reminder id being edited, or 'new'
  const [form, setForm] = useState<CreateReminderDto>(emptyForm());
  const [amountStr, setAmountStr] = useState('');
  const [error, setError] = useState('');
  const set = (patch: Partial<CreateReminderDto>) => setForm((f) => ({ ...f, ...patch }));

  const openNew = () => { setForm(emptyForm()); setAmountStr(''); setEditing('new'); setError(''); };
  const openEdit = (r: Reminder) => {
    setForm({ title: r.title, kind: r.kind, recurrence: r.recurrence, dayOfMonth: r.dayOfMonth ?? 1, date: r.date?.slice(0, 10), note: r.note ?? '' });
    setAmountStr(r.amount ? String(r.amount) : '');
    setEditing(r.id);
    setError('');
  };

  const save = () => {
    setError('');
    if (!form.title.trim()) return setError('اكتب عنوان التذكير');
    if (form.recurrence === 'ONCE' && !form.date) return setError('اختر التاريخ');
    const dto: CreateReminderDto = {
      title: form.title.trim(),
      kind: form.kind,
      amount: Number(amountStr) || undefined,
      recurrence: form.recurrence,
      dayOfMonth: form.recurrence === 'MONTHLY' ? Number(form.dayOfMonth) || 1 : undefined,
      date: form.recurrence === 'ONCE' ? form.date : undefined,
      note: form.note?.trim() || undefined,
    };
    const onDone = () => setEditing(null);
    if (editing === 'new') createR.mutate(dto, { onSuccess: onDone, onError: (e: any) => setError(e.message) });
    else if (editing) updateR.mutate({ id: editing, dto }, { onSuccess: onDone, onError: (e: any) => setError(e.message) });
  };

  const list = reminders ?? [];
  const due = list.filter((r) => r.due);

  return (
    <>
      <PageTitle title="التذكيرات" subtitle="أقساط ومصاريف شهرية، نقدية تتحصّل أو تتدفع، مواعيد، وأي حاجة شخصية — خاصة بيك أنت بس" />

      <div className="toolbar">
        <button className="btn btn-primary btn-sm sp" onClick={openNew}>+ تذكير جديد</button>
        {due.length > 0 && <span className="pill" style={{ background: 'var(--debit-bg, #fdecea)', color: 'var(--debit)' }}>{due.length} مستحق اليوم</span>}
      </div>

      {editing && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>{editing === 'new' ? 'تذكير جديد' : 'تعديل التذكير'}</div>
          <div className="form-grid">
            <Field label="العنوان" full><input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="مثلاً: قسط العربية" /></Field>
            <Field label="النوع">
              <select value={form.kind} onChange={(e) => set({ kind: e.target.value as ReminderKind })} style={{ width: '100%' }}>
                {KINDS.map((k) => <option key={k} value={k}>{REMINDER_KIND_LABEL[k]}</option>)}
              </select>
            </Field>
            <Field label="التكرار">
              <select value={form.recurrence} onChange={(e) => set({ recurrence: e.target.value as ReminderRecurrence })} style={{ width: '100%' }}>
                <option value="MONTHLY">كل شهر</option>
                <option value="ONCE">مرة واحدة</option>
              </select>
            </Field>
            {form.recurrence === 'MONTHLY' ? (
              <Field label="يوم الشهر (1–28)">
                <input type="number" min={1} max={28} value={form.dayOfMonth ?? 1} onChange={(e) => set({ dayOfMonth: Number(e.target.value) })} />
              </Field>
            ) : (
              <Field label="التاريخ">
                <input type="date" value={form.date ?? todayISO()} onChange={(e) => set({ date: e.target.value })} />
              </Field>
            )}
            <Field label="المبلغ (اختياري)"><MoneyInput value={amountStr} onChange={setAmountStr} placeholder="0.00" /></Field>
            <Field label="ملاحظة (اختياري)" full><input value={form.note ?? ''} onChange={(e) => set({ note: e.target.value })} /></Field>
          </div>
          {error && <div className="err-text">{error}</div>}
          <div className="toolbar" style={{ marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={createR.isPending || updateR.isPending}>حفظ</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>إلغاء</button>
          </div>
        </div>
      )}

      {isLoading ? <Spinner /> : list.length === 0 ? (
        <div className="empty">لا توجد تذكيرات — أضف أول تذكير</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {list.map((r) => (
            <div key={r.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', ...(r.due ? { borderInlineStart: '4px solid var(--debit)' } : {}) }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700 }}>
                  {r.title}
                  {r.due && <span className="pill" style={{ marginInlineStart: 8, background: (r.daysUntil ?? 0) > 0 ? 'var(--gold)' : 'var(--debit)', color: '#fff' }}>{dueText(r.daysUntil)}</span>}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  <span className="pill" style={{ marginInlineEnd: 6 }}>{REMINDER_KIND_LABEL[r.kind]}</span>
                  {scheduleText(r)}
                  {r.amount > 0 && <> · <b>{EGP(r.amount)} ج.م</b></>}
                  {r.note && <> · {r.note}</>}
                </div>
              </div>
              <div className="toolbar" style={{ margin: 0 }}>
                {r.due ? (
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--credit)' }} onClick={() => doneR.mutate(r.id)} disabled={doneR.isPending}>✓ تم</button>
                ) : (
                  (r.doneMonth || r.doneAt) && <button className="btn btn-ghost btn-sm" onClick={() => undoR.mutate(r.id)} disabled={undoR.isPending}>↩ تراجع</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>✏</button>
                <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm(`حذف تذكير "${r.title}"؟`)) deleteR.mutate(r.id); }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
