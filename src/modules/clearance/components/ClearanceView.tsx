'use client';

import { useState } from 'react';
import { EGP, fmtDate, todayISO } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { PageTitle, Field, Combobox, MoneyInput, Spinner } from '@/components/common';
import { useManifests } from '../../manifests/hooks';
import { useAllTreasury } from '../../treasury/hooks';
import { useAllExpenseCategories } from '../../expense-categories/hooks';
import {
  useAddClearanceExpense, useClearance, useClearanceAgents,
  useDeleteClearanceMovement, usePayClearanceAgent,
} from '../hooks';
import type { ClearanceAgent } from '../dtos';

const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const inputStyle = {
  padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13,
};
const selectStyle = {
  width: '100%', padding: '11px 12px', border: '1.5px solid var(--line)',
  borderRadius: 10, background: '#fff',
};

export function ClearanceView() {
  const { can } = useAuth();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [form, setForm] = useState<'expense' | 'pay' | null>(null);

  const { data, isLoading } = useClearance({
    from: from || undefined, to: to || undefined, agentId: agentFilter || undefined,
  });
  const { data: agents } = useClearanceAgents();
  const del = useDeleteClearanceMovement();

  const agentList = agents ?? [];
  const noAgents = agentList.length === 0;

  return (
    <>
      <PageTitle
        title="التخليص والجمارك"
        subtitle="مصاريف الجمارك على العربيات — بتترحّل على حساب المخلّص، ومعاملتها زي الناولون (مش داخلة في تكلفة الصنف)"
      />

      {noAgents && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <b>مفيش مخلّصين مسجّلين.</b>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            سجّل المخلّص من «كشف الحساب ← السجل ← المخلّصين» الأول، وبعدها تقدر ترحّل عليه مصاريف.
          </div>
        </div>
      )}

      {/* ملخّص كل مخلّص: اترحّل له في الفترة، اتسدّد، والمستحق الكلي */}
      {!!data?.agents?.length && (
        <div className="grid stats" style={{ marginBottom: 12 }}>
          {data.agents.map((a) => (
            <div key={a.uid} className="card stat">
              <div className="lbl">{a.name}</div>
              <div
                className="val num"
                style={{ fontSize: 19, color: a.due > 0 ? 'var(--debit)' : 'var(--ink)' }}
              >
                {EGP(a.due)}
              </div>
              <div className="tag">
                {a.due > 0 ? 'مستحق له' : a.due < 0 ? 'مدفوع زيادة' : 'مقفول'}
                {' · '}الفترة: {EGP(a.expenses)} مصاريف / {EGP(a.paid)} سداد
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="toolbar">
        {can('clearance.expense') && (
          <button
            className="btn btn-primary btn-sm"
            disabled={noAgents}
            onClick={() => setForm(form === 'expense' ? null : 'expense')}
          >
            {form === 'expense' ? '× إلغاء' : '+ مصروف جمارك'}
          </button>
        )}
        {can('clearance.pay') && (
          <button
            className="btn btn-ghost btn-sm"
            disabled={noAgents}
            onClick={() => setForm(form === 'pay' ? null : 'pay')}
          >
            {form === 'pay' ? '× إلغاء' : 'سداد لمخلّص'}
          </button>
        )}
        <span className="muted" style={{ fontSize: 12, marginInlineStart: 'auto' }}>من</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
        <span className="muted" style={{ fontSize: 12 }}>إلى</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} style={inputStyle}>
          <option value="">كل المخلّصين</option>
          {agentList.map((a) => <option key={a.uid} value={a.uid}>{a.name}</option>)}
        </select>
      </div>

      {form === 'expense' && <ExpenseForm agents={agentList} onDone={() => setForm(null)} />}
      {form === 'pay' && <PayForm agents={agentList} onDone={() => setForm(null)} />}

      <div className="card tbl-wrap">
        {isLoading ? <Spinner /> : (
          <table>
            <thead>
              <tr>
                <th>التاريخ</th><th>البيان</th><th>العربية</th><th>العميل</th>
                <th>المخلّص</th><th className="num">مصروف</th><th className="num">سداد</th><th></th>
              </tr>
            </thead>
            <tbody>
              {(data?.movements ?? []).map((m) => (
                <tr key={m.uid}>
                  <td className="muted">{fmtDate(m.date)}</td>
                  <td>
                    {m.note || m.type}
                    {m.category ? <span className="muted"> · {m.category.name}</span> : null}
                  </td>
                  <td>{m.manifest ? `كشف ${m.manifest.no}` : <span className="muted">—</span>}</td>
                  <td className="muted">{m.manifest?.clientName ?? '—'}</td>
                  <td>{m.party?.name ?? '—'}</td>
                  <td className="num deb">{m.credit ? EGP(m.credit) : ''}</td>
                  <td className="num cre">{m.debit ? EGP(m.debit) : ''}</td>
                  <td>
                    {can('clearance.delete') && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--debit)' }}
                        disabled={del.isPending}
                        onClick={() => {
                          if (!window.confirm('حذف الحركة دي؟ هتتشال من كشف حساب المخلّص ومن الخزنة.')) return;
                          del.mutate(m.uid);
                        }}
                      >
                        حذف
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!data?.movements?.length && (
                <tr><td colSpan={8} className="empty">مفيش حركات تخليص في الفترة دي</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ── مصروف جمارك على عربية ────────────────────────────────────────── */
function ExpenseForm({ agents, onDone }: { agents: ClearanceAgent[]; onDone: () => void }) {
  const add = useAddClearanceExpense();
  const { data: categories } = useAllExpenseCategories();
  const [agentId, setAgentId] = useState(agents[0]?.uid ?? '');
  const [manifestId, setManifestId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  // Combobox بيفلتر محليًا، فبنجيب دفعة كبيرة مرة واحدة بدل بحث على السيرفر
  const { data: manifestsPage } = useManifests({ pageSize: 200 });
  // العربيات اللي خروجها من المخزن بس — مكتب الشحن مالوش تخليص عندنا،
  // والباك إند بيرفضه كمان لو حد حاول.
  const options = (manifestsPage?.data ?? []).filter((m) => m.vehicleSource === 'OURS');

  const save = () => {
    setErr('');
    if (!agentId) return setErr('اختر المخلّص');
    if (!manifestId) return setErr('اختر كشف العربية');
    if (!Number(amount)) return setErr('اكتب المبلغ');
    add.mutate(
      {
        manifestId, agentId, date, amount: Number(amount),
        categoryId: categoryId || undefined, note: note.trim() || undefined,
      },
      { onSuccess: onDone, onError: (e: any) => setErr(e?.message || 'مانفعش الحفظ') },
    );
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="form-grid">
        <Field label="المخلّص">
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} style={selectStyle}>
            {agents.map((a) => <option key={a.uid} value={a.uid}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="التاريخ">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="كشف العربية" full>
          <Combobox
            options={options.map((m) => ({
              id: m.id,
              name: `كشف ${m.no} — ${m.clientName} — ${fmtDate(m.date)}`,
            }))}
            value={manifestId}
            onChange={(id) => setManifestId(id)}
            placeholder="اكتب رقم الكشف أو اسم العميل…"
          />
        </Field>
        <Field label="المبلغ"><MoneyInput value={amount} onChange={setAmount} placeholder="0.00" /></Field>
        <Field label="البند (اختياري)">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={selectStyle}>
            <option value="">— من غير بند —</option>
            {(categories?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="البيان (اختياري)" full>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="رسوم جمركية / أرضيات / أتعاب…"
          />
        </Field>
      </div>
      {err && <div className="err-text" style={{ padding: '0 16px' }}>{err}</div>}
      <div className="toolbar" style={{ padding: '0 16px 14px', marginBottom: 0 }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={add.isPending}>
          {add.isPending ? '…' : 'ترحيل على المخلّص'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>إلغاء</button>
      </div>
    </div>
  );
}

/* ── سداد لمخلّص ──────────────────────────────────────────────────── */
function PayForm({ agents, onDone }: { agents: ClearanceAgent[]; onDone: () => void }) {
  const pay = usePayClearanceAgent();
  const { data: treasury } = useAllTreasury();
  const [agentId, setAgentId] = useState(agents[0]?.uid ?? '');
  const [treasuryId, setTreasuryId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const save = () => {
    setErr('');
    if (!agentId) return setErr('اختر المخلّص');
    if (!treasuryId) return setErr('اختر الخزنة');
    if (!Number(amount)) return setErr('اكتب المبلغ');
    pay.mutate(
      { agentId, treasuryId, date, amount: Number(amount), note: note.trim() || undefined },
      { onSuccess: onDone, onError: (e: any) => setErr(e?.message || 'مانفعش الحفظ') },
    );
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="form-grid">
        <Field label="المخلّص">
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} style={selectStyle}>
            {agents.map((a) => <option key={a.uid} value={a.uid}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="التاريخ">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="المبلغ"><MoneyInput value={amount} onChange={setAmount} placeholder="0.00" /></Field>
        <Field label="من خزنة">
          <Combobox
            options={treasury?.data ?? []}
            value={treasuryId}
            onChange={setTreasuryId}
            placeholder="اختر الخزنة"
          />
        </Field>
        <Field label="البيان (اختياري)" full>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      {err && <div className="err-text" style={{ padding: '0 16px' }}>{err}</div>}
      <div className="toolbar" style={{ padding: '0 16px 14px', marginBottom: 0 }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={pay.isPending}>
          {pay.isPending ? '…' : 'تسجيل السداد'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>إلغاء</button>
      </div>
    </div>
  );
}
