'use client';

import { useState } from 'react';
import { fmtDate, EGP } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { Field, Combobox, MoneyInput } from '@/components/common';
import { useAllParties } from '../../parties/hooks';
import { useForexAgent, useUsdOut, useDeleteAgentTx, useUpdateAgent } from '../hooks';

function today() { return new Date().toISOString().slice(0, 10); }

export function AgentDetail({ agentUid, onBack, initialMode }: { agentUid: string; onBack: () => void; initialMode?: 'usd' | 'edit' | null }) {
  const { user } = useAuth();
  const { data: agent, isLoading } = useForexAgent(agentUid);
  const { data: suppliers } = useAllParties('SUPPLIER');
  const usdOut = useUsdOut(agentUid);
  const deleteTx = useDeleteAgentTx(agentUid);
  const updateAgent = useUpdateAgent();

  const [mode, setMode] = useState<null | 'usd' | 'edit'>(initialMode ?? null);

  // USD_OUT form
  const [usdDate, setUsdDate] = useState(today());
  const [usdAmt, setUsdAmt] = useState('');
  const [usdRate, setUsdRate] = useState('');
  const [usdParty, setUsdParty] = useState('');
  const [usdNote, setUsdNote] = useState('');
  const [usdErr, setUsdErr] = useState('');

  // edit form
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editErr, setEditErr] = useState('');

  const openEdit = () => {
    setEditName(agent?.name ?? '');
    setEditPhone(agent?.phone ?? '');
    setEditNote(agent?.note ?? '');
    setMode('edit');
  };

  if (isLoading) return <div className="empty">جاري التحميل…</div>;
  if (!agent) return <div className="empty">لم يُوجد</div>;

  const saveUsd = () => {
    setUsdErr('');
    if (!usdAmt || Number(usdAmt) <= 0) return setUsdErr('اكتب المبلغ بالدولار');
    if (!usdRate || Number(usdRate) <= 0) return setUsdErr('اكتب سعر الصرف');
    if (!usdParty) return setUsdErr('اختر العميل');
    usdOut.mutate(
      { date: usdDate, usdAmount: Number(usdAmt), exchangeRate: Number(usdRate), partyId: usdParty, note: usdNote || undefined },
      { onSuccess: () => { setUsdAmt(''); setUsdRate(''); setUsdParty(''); setUsdNote(''); setMode(null); }, onError: (e: any) => setUsdErr(e.message) },
    );
  };

  const saveEdit = () => {
    setEditErr('');
    if (!editName.trim()) return setEditErr('اكتب الاسم');
    updateAgent.mutate(
      { uid: agentUid, dto: { name: editName.trim(), phone: editPhone.trim() || undefined, note: editNote.trim() || undefined } },
      { onSuccess: () => setMode(null), onError: (e: any) => setEditErr(e.message) },
    );
  };

  const egpInTotal = agent.egpIn;
  const egpOutTotal = agent.egpOut;
  const balance = agent.balance;

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع</button>
        {user?.admin && <button className="btn btn-ghost btn-sm" onClick={openEdit}>تعديل البيانات</button>}
      </div>

      {/* header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>{agent.name}</h2>
        {agent.phone && <div className="muted" style={{ fontSize: 13 }}>{agent.phone}</div>}
        {agent.note && <div className="muted" style={{ fontSize: 12 }}>{agent.note}</div>}
      </div>

      {/* balance summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginBottom: 20 }}>
        {[['إجمالي استلم', EGP(egpInTotal), 'cre'], ['إجمالي ورّد', EGP(egpOutTotal), 'deb'], ['المتبقّي عنده', EGP(Math.abs(balance)), balance > 0 ? 'deb' : 'cre']].map(([l, v, cls]) => (
          <div key={l} className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 11 }}>{l}</div>
            <div className={`num ${cls}`} style={{ fontWeight: 800, fontSize: 15 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* action buttons */}
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setMode(mode === 'usd' ? null : 'usd')}>+ توريد دولار لعميل</button>
      </div>

      {/* USD_OUT form */}
      {mode === 'usd' && (
        <div className="card" style={{ padding: 16, marginBottom: 16, border: '1.5px dashed var(--credit)' }}>
          <b style={{ fontSize: 14, display: 'block', marginBottom: 10 }}>توريد دولار لعميل</b>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Field label="التاريخ"><input type="date" value={usdDate} onChange={(e) => setUsdDate(e.target.value)} /></Field>
            <Field label="المبلغ ($)"><MoneyInput value={usdAmt} onChange={setUsdAmt} placeholder="0.00" style={{ maxWidth: 130 }} /></Field>
            <Field label="سعر الصرف"><MoneyInput value={usdRate} onChange={setUsdRate} placeholder="0.00" style={{ maxWidth: 130 }} /></Field>
            <Field label="المورد الدولاري">
              <div style={{ minWidth: 200 }}>
                <Combobox
                  options={(suppliers?.data ?? []).filter((s: any) => s.currency === 'USD')}
                  value={usdParty}
                  onChange={setUsdParty}
                  placeholder="اختر المورد الدولاري…"
                />
              </div>
            </Field>
            <Field label="ملاحظة"><input value={usdNote} onChange={(e) => setUsdNote(e.target.value)} placeholder="اختياري…" style={{ maxWidth: 200 }} /></Field>
          </div>
          {usdRate && usdAmt && (
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              المكافئ بالجنيه: <b className="num">{EGP(Number(usdAmt) * Number(usdRate))}</b>
              <span style={{ marginInlineStart: 12 }}>الرصيد بعد التوريد: <b className="num">{EGP(balance - Number(usdAmt) * Number(usdRate))}</b></span>
            </div>
          )}
          {usdErr && <div className="err-text" style={{ marginTop: 8 }}>{usdErr}</div>}
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={saveUsd} disabled={usdOut.isPending}>حفظ</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setMode(null)}>إلغاء</button>
          </div>
        </div>
      )}

      {/* edit form */}
      {mode === 'edit' && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <b style={{ fontSize: 14, display: 'block', marginBottom: 10 }}>تعديل بيانات الوكيل</b>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Field label="الاسم"><input value={editName} onChange={(e) => setEditName(e.target.value)} /></Field>
            <Field label="الهاتف"><input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></Field>
            <Field label="ملاحظة"><input value={editNote} onChange={(e) => setEditNote(e.target.value)} /></Field>
          </div>
          {editErr && <div className="err-text" style={{ marginTop: 8 }}>{editErr}</div>}
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={updateAgent.isPending}>حفظ</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setMode(null)}>إلغاء</button>
          </div>
        </div>
      )}

      {/* transactions ledger */}
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>التاريخ</th><th>النوع</th><th>التفاصيل</th><th>المبلغ (ج.م)</th><th>المبلغ ($)</th><th>سعر الصرف</th>{user?.admin && <th></th>}</tr>
          </thead>
          <tbody>
            {agent.txs.length === 0 && (
              <tr><td colSpan={user?.admin ? 7 : 6} className="muted" style={{ textAlign: 'center', padding: 16 }}>لا توجد حركات</td></tr>
            )}
            {agent.txs.map((tx) => (
              <tr key={tx.id}>
                <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(tx.date)}</td>
                <td>
                  {tx.type === 'EGP_IN'
                    ? <span className="pill" style={{ background: 'var(--credit-bg)', color: 'var(--credit)' }}>استلم جنيه</span>
                    : <span className="pill" style={{ background: 'var(--debit-bg)', color: 'var(--debit)' }}>ورّد دولار</span>}
                </td>
                <td className="muted" style={{ fontSize: 12 }}>
                  {tx.type === 'EGP_IN' ? (tx.treasury?.name ?? '') : (tx.party?.name ?? '')}
                  {tx.note && <span> — {tx.note}</span>}
                </td>
                <td className="num cre">{tx.type === 'EGP_IN' ? EGP(tx.egpAmount) : EGP(tx.usdAmount * tx.exchangeRate)}</td>
                <td className="num">{tx.type === 'USD_OUT' ? `$${tx.usdAmount.toLocaleString('en', { minimumFractionDigits: 2 })}` : '—'}</td>
                <td className="num muted">{tx.type === 'USD_OUT' ? tx.exchangeRate : '—'}</td>
                {user?.admin && (
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => {
                      if (!window.confirm('حذف هذه الحركة؟')) return;
                      deleteTx.mutate(tx.id);
                    }}>×</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
