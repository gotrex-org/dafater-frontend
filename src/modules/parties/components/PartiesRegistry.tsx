'use client';

import { useEffect, useState } from 'react';
import { EGP } from '@/lib/format';
import { useTableState } from '@/lib/useTableState';
import { SegmentedControl, SearchInput, MoneyInput } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useParties, useCreateParty, useUpdateParty, useDeleteParty } from '../hooks';
import type { Party } from '../dtos';

function PartyRow({ party, canDelete }: { party: Party; canDelete: boolean }) {
  const update = useUpdateParty();
  const del = useDeleteParty();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(party.name);
  const [phone, setPhone] = useState(party.phone ?? '');
  const [currency, setCurrency] = useState<'EGP' | 'USD'>(party.currency ?? 'EGP');
  const [opening, setOpening] = useState(String(party.opening ?? 0));
  const [msg, setMsg] = useState('');

  const save = () => {
    if (!name.trim()) return setMsg('اكتب الاسم');
    update.mutate(
      { id: party.id, dto: { name: name.trim(), phone: phone.trim() || undefined, currency, opening: Number(opening) || 0 } },
      { onSuccess: () => { setMsg('تم الحفظ ✓'); setOpen(false); }, onError: (e: any) => setMsg(e.message) },
    );
  };

  const remove = () => {
    if (!confirm(`حذف ${party.name}؟ لا يمكن التراجع.`)) return;
    del.mutate(party.id, { onError: (e: any) => setMsg(e.message) });
  };

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, fontWeight: 700 }}>
          {party.name}
          {party.currency === 'USD' && <span className="pill" style={{ marginInlineStart: 6 }}>دولار</span>}
          {party.phone && <span className="muted" style={{ fontSize: 12, fontWeight: 400, marginInlineStart: 8 }}>{party.phone}</span>}
        </span>
        <span className={`num ${(party.balance ?? 0) >= 0 ? 'deb' : 'cre'}`} style={{ fontWeight: 700 }}>{EGP(party.balance)}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>{open ? 'إغلاق' : 'تعديل'}</button>
        {canDelete && <button className="btn btn-danger btn-sm" onClick={remove} disabled={del.isPending}>حذف</button>}
      </div>
      {open && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 130 }} />
          <input placeholder="تليفون" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ maxWidth: 140 }} />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <input type="checkbox" checked={currency === 'USD'} onChange={(e) => setCurrency(e.target.checked ? 'USD' : 'EGP')} />
            {party.role === 'CLIENT' ? 'عميل دولاري $' : 'مورد دولاري $'}
          </label>
          <MoneyInput value={opening} onChange={setOpening} placeholder="رصيد افتتاحي" style={{ maxWidth: 130 }} />
          <button className="btn btn-primary btn-sm" onClick={save} disabled={update.isPending}>حفظ</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>إلغاء</button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      )}
    </div>
  );
}

export function PartiesRegistry() {
  const { user } = useAuth();
  const [role, setRole] = useState<'CLIENT' | 'SUPPLIER'>('CLIENT');
  const [search, setSearch] = useState('');
  const { page, setPage, pageSize } = useTableState();
  const { data, isLoading } = useParties({ role, all: true });
  const createParty = useCreateParty();
  const [adding, setAdding] = useState(false);
  const [pName, setPName] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pCurrency, setPCurrency] = useState<'EGP' | 'USD'>('EGP');
  const [pErr, setPErr] = useState('');

  const roleLabel = role === 'CLIENT' ? 'عميل' : 'مورد';

  const addParty = () => {
    if (!pName.trim()) { setPErr('اكتب الاسم'); return; }
    setPErr('');
    createParty.mutate(
      { name: pName.trim(), role, type: 'INVOICE', currency: pCurrency, phone: pPhone.trim() || undefined },
      { onSuccess: () => { setPName(''); setPPhone(''); setAdding(false); }, onError: (e: any) => setPErr(e.message) },
    );
  };

  useEffect(() => { setPage(1); }, [role, search]);

  const all = data?.data ?? [];
  const filtered = all
    .filter((p) => !search.trim() || p.name.includes(search.trim()))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <SegmentedControl
          value={role}
          onChange={setRole}
          options={[{ value: 'CLIENT', label: 'العملاء' }, { value: 'SUPPLIER', label: 'الموردين' }]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم…" />
        {!adding && (
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>+ {roleLabel} جديد</button>
        )}
      </div>

      {adding && (
        <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input autoFocus placeholder={`اسم ال${roleLabel}`} value={pName} onChange={(e) => setPName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addParty(); if (e.key === 'Escape') setAdding(false); }}
            style={{ flex: 1, minWidth: 150 }} />
          <input placeholder="تليفون (اختياري)" value={pPhone} onChange={(e) => setPPhone(e.target.value)} style={{ maxWidth: 150 }} />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <input type="checkbox" checked={pCurrency === 'USD'} onChange={(e) => setPCurrency(e.target.checked ? 'USD' : 'EGP')} />
            {role === 'CLIENT' ? 'عميل دولاري $' : 'مورد دولاري $'}
          </label>
          <button className="btn btn-primary btn-sm" onClick={addParty} disabled={createParty.isPending}>حفظ</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setPName(''); setPErr(''); }}>إلغاء</button>
          {pErr && <span className="err-text">{pErr}</span>}
        </div>
      )}

      <div>
        {isLoading && <div className="empty">جاري التحميل…</div>}
        {!isLoading && pageRows.length === 0 && <div className="empty">لا يوجد</div>}
        {pageRows.map((p) => <PartyRow key={p.id} party={p} canDelete={!!user?.admin} />)}
      </div>

      {total > pageSize && (
        <div className="toolbar" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</button>
          <span className="muted" style={{ fontSize: 13 }}>{page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>التالي</button>
        </div>
      )}
    </>
  );
}
