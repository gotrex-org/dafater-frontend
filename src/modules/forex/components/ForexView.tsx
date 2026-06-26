'use client';

import { useState } from 'react';
import { fmtDate, EGP } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { PageTitle, Field } from '@/components/common';
import { useForexAgents, useCreateAgent, useDeleteAgent } from '../hooks';
import type { DollarAgent } from '../dtos';
import { AgentDetail } from './AgentDetail';

function AgentCard({ agent, onClick, onDelete, onTransfer, canAdmin }: {
  agent: DollarAgent; onClick: () => void; onDelete: () => void; onTransfer: () => void; canAdmin: boolean;
}) {
  const bal = agent.balance;
  return (
    <div className="card" style={{ padding: 16, cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{agent.name}</div>
          {agent.phone && <div className="muted" style={{ fontSize: 12 }}>{agent.phone}</div>}
        </div>
        {canAdmin && (
          <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); onDelete(); }}>حذف</button>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <div className="muted" style={{ fontSize: 11 }}>المتبقّي</div>
        <div className="num" style={{ fontWeight: 800, fontSize: 18, color: bal > 0 ? 'var(--debit)' : 'var(--credit)' }}>{EGP(Math.abs(bal))}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={(e) => { e.stopPropagation(); onTransfer(); }}
        >
          توريد دولار
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          كشف الحساب
        </button>
      </div>
    </div>
  );
}

function NewAgentForm({ onDone }: { onDone: () => void }) {
  const create = useCreateAgent();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const save = () => {
    if (!name.trim()) return setErr('اكتب الاسم');
    create.mutate(
      { name: name.trim(), phone: phone.trim() || undefined, note: note.trim() || undefined },
      { onSuccess: onDone, onError: (e: any) => setErr(e.message) },
    );
  };

  return (
    <div className="card" style={{ padding: 16, border: '1.5px dashed var(--line)', display: 'grid', gap: 10 }}>
      <b style={{ fontSize: 14 }}>وكيل جديد</b>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Field label="الاسم"><input value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 200 }} /></Field>
        <Field label="الهاتف"><input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ maxWidth: 150 }} /></Field>
        <Field label="ملاحظة"><input value={note} onChange={(e) => setNote(e.target.value)} style={{ maxWidth: 200 }} /></Field>
      </div>
      {err && <div className="err-text">{err}</div>}
      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={save} disabled={create.isPending}>إضافة</button>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>إلغاء</button>
      </div>
    </div>
  );
}

export function ForexView({ embedded }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { data: agents, isLoading } = useForexAgents();
  const deleteAgent = useDeleteAgent();
  const [selected, setSelected] = useState<DollarAgent | null>(null);
  const [selectedMode, setSelectedMode] = useState<'usd' | null>(null);
  const [adding, setAdding] = useState(false);

  if (selected) return <AgentDetail agentUid={selected.id} onBack={() => { setSelected(null); setSelectedMode(null); }} initialMode={selectedMode} />;

  const totEgpIn = (agents ?? []).reduce((s, a) => s + a.egpIn, 0);
  const totEgpOut = (agents ?? []).reduce((s, a) => s + a.egpOut, 0);

  return (
    <>
      {!embedded && <PageTitle title="وسطاء الصرف" subtitle="تتبّع الوكلاء الذين يستلمون جنيهات ويوردون دولارات للعملاء" />}

      {/* summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
        {[['إجمالي استلموا', EGP(totEgpIn), 'cre'], ['إجمالي وردّوا', EGP(totEgpOut), 'deb'], ['إجمالي متبقّي', EGP(totEgpIn - totEgpOut), '']].map(([label, val, cls]) => (
          <div key={label} className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 12 }}>{label}</div>
            <div className={`num ${cls}`} style={{ fontWeight: 800, fontSize: 16 }}>{val}</div>
          </div>
        ))}
      </div>

      {user?.admin && (
        <div className="toolbar" style={{ marginBottom: 16 }}>
          {!adding && <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ وكيل جديد</button>}
        </div>
      )}

      {adding && <div style={{ marginBottom: 16 }}><NewAgentForm onDone={() => setAdding(false)} /></div>}

      {isLoading && <div className="empty">جاري التحميل…</div>}
      <div style={{ display: 'grid', gap: 12 }}>
        {(agents ?? []).map((a) => (
          <AgentCard
            key={a.id}
            agent={a}
            onClick={() => setSelected(a)}
            onTransfer={() => { setSelectedMode('usd'); setSelected(a); }}
            canAdmin={!!user?.admin}
            onDelete={() => {
              if (!window.confirm(`حذف الوكيل "${a.name}"؟`)) return;
              deleteAgent.mutate(a.id);
            }}
          />
        ))}
        {!isLoading && agents?.length === 0 && <div className="empty">لا يوجد وكلاء — أضف وكيلاً جديداً</div>}
      </div>
    </>
  );
}
