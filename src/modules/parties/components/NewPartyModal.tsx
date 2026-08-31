'use client';

import { useState } from 'react';
import { Field } from '@/components/common';
import { useCreateParty } from '../hooks';
import type { Party, PartyRole } from '../dtos';

/**
 * The couple of details worth capturing while a party is being born mid-entry, from
 * wherever a party gets picked. Everything else (رصيد افتتاحي، العملة، …) stays on
 * the الأطراف page.
 *
 * It renders inside whatever field opened it — which may be a clickable table row —
 * so it stops its own mouse events rather than letting them bubble into one.
 */
export function NewPartyModal({
  initialName,
  role,
  label,
  onCreated,
  onClose,
}: {
  initialName: string;
  role: PartyRole;
  label: string;
  onCreated: (p: Party) => void;
  onClose: () => void;
}) {
  const createParty = useCreateParty();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const save = () => {
    const n = name.trim();
    if (!n) return setError('اكتب الاسم');
    setError('');
    createParty.mutate(
      { name: n, role, type: 'INVOICE', phone: phone.trim() || undefined },
      { onSuccess: onCreated, onError: (e: any) => setError(e.message ?? 'حدث خطأ') },
    );
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); save(); }
    else if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>{label} جديد</b>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <Field label="الاسم">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKeyDown} />
          </Field>
          <Field label="التليفون">
            <input value={phone} inputMode="tel" placeholder="اختياري" onChange={(e) => setPhone(e.target.value)} onKeyDown={onKeyDown} />
          </Field>
          {error && <div className="err-text">{error}</div>}
        </div>
        <div className="toolbar" style={{ padding: '12px 16px' }}>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={createParty.isPending}>
            {createParty.isPending ? '...' : 'حفظ'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
