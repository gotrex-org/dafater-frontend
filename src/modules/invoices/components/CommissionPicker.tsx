'use client';

import { useState } from 'react';
import { useAllParties, useCreateParty, useUpdateParty } from '../../parties/hooks';

const NEW = '__new__';

/**
 * Picks the commission recipient (an AGENT party) for a purchase invoice.
 * The commission amount is credited to this party's ledger on save.
 * Supports adding a new agent inline and removing (hiding) an existing one.
 */
export function CommissionPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data } = useAllParties('AGENT');
  const agents = data?.data ?? [];
  const createParty = useCreateParty();
  const updateParty = useUpdateParty();

  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  const add = () => {
    if (!name.trim()) { setErr('اكتب الاسم'); return; }
    setErr('');
    createParty.mutate(
      { name: name.trim(), role: 'AGENT', type: 'LEDGER' },
      {
        onSuccess: (p) => { onChange(p.id); setName(''); setAdding(false); },
        onError: (e: any) => setErr(e.message),
      },
    );
  };

  // remove = hide (keeps the agent's ledger history intact)
  const remove = (id: string) =>
    updateParty.mutate(
      { id, dto: { hidden: true } },
      { onSuccess: () => { if (value === id) onChange(''); } },
    );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.stopPropagation(); add(); }
    else if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); setName(''); setErr(''); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.stopPropagation();
  };

  if (adding) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input autoFocus placeholder="اسم صاحب commission" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKeyDown} />
        <button className="btn btn-primary btn-sm" onClick={add} disabled={createParty.isPending}>{createParty.isPending ? '...' : 'حفظ'}</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setName(''); setErr(''); }}>×</button>
        {err && <span className="err-text">{err}</span>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <select
          value={value}
          onChange={(e) => { e.target.value === NEW ? setAdding(true) : onChange(e.target.value); }}
          style={{ flex: 1 }}
        >
          <option value="">— بدون —</option>
          {agents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value={NEW}>+ شخص جديد…</option>
        </select>
        {agents.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setManaging((m) => !m)} title="إدارة الأشخاص">
            {managing ? 'تم' : 'إدارة'}
          </button>
        )}
      </div>
      {managing && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {agents.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <span style={{ flex: 1 }}>{p.name}</span>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(p.id)} title="إزالة من القائمة">× إزالة</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
