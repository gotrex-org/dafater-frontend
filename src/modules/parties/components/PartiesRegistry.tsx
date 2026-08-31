'use client';

import { useEffect, useState } from 'react';
import { EGP } from '@/lib/format';
import { useTableState } from '@/lib/useTableState';
import { SegmentedControl, SearchInput, MoneyInput } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useParties, useCreateParty, useUpdateParty, useDeleteParty, useLinkParty, useUnlinkParty, useAllParties } from '../hooks';
import { useDeleteWithRelated } from '@/lib/deleteWithRelated';
import type { Party } from '../dtos';

function LinkPanel({ party, canManage, otherRole }: { party: Party; canManage: boolean; otherRole: 'CLIENT' | 'SUPPLIER' }) {
  const linked = party.linkedParty ?? party.linkedFrom ?? null;
  const { data: others } = useAllParties(otherRole);
  const linkMut = useLinkParty();
  const unlinkMut = useUnlinkParty();
  const [show, setShow] = useState(false);
  const [selectedUid, setSelectedUid] = useState('');
  const [err, setErr] = useState('');

  if (!canManage) {
    if (!linked) return null;
    return <span className="pill muted" style={{ fontSize: 11, marginInlineStart: 8 }}>مرتبط بـ {linked.name}</span>;
  }

  if (linked) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginInlineStart: 8 }}>
        <span className="pill" style={{ fontSize: 11, background: 'var(--accent-soft, #e8f0fe)', color: 'var(--accent, #1a56db)' }}>
          🔗 {linked.name}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11, padding: '2px 8px' }}
          onClick={() => { if (confirm(`فك الربط مع "${linked.name}"؟`)) unlinkMut.mutate(party.id, { onError: (e: any) => alert(e.message) }); }}
          disabled={unlinkMut.isPending}
        >
          فك الربط
        </button>
      </span>
    );
  }

  if (!show) {
    return (
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px', marginInlineStart: 8 }} onClick={() => setShow(true)}>
        + ربط
      </button>
    );
  }

  const choices = (others?.data ?? []).filter((p) => !p.linkedParty && !p.linkedFrom);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginInlineStart: 8 }}>
      <select
        value={selectedUid}
        onChange={(e) => setSelectedUid(e.target.value)}
        style={{ padding: '4px 8px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 12 }}
      >
        <option value="">اختر {otherRole === 'CLIENT' ? 'عميل' : 'مورد'}…</option>
        {choices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button
        className="btn btn-primary btn-sm"
        style={{ fontSize: 11, padding: '4px 10px' }}
        disabled={!selectedUid || linkMut.isPending}
        onClick={() => {
          setErr('');
          linkMut.mutate(
            { id: party.id, linkedPartyUid: selectedUid },
            { onSuccess: () => setShow(false), onError: (e: any) => setErr(e.message) },
          );
        }}
      >
        ربط
      </button>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => { setShow(false); setErr(''); }}>
        إلغاء
      </button>
      {err && <span className="err-text" style={{ fontSize: 11 }}>{err}</span>}
    </span>
  );
}

function PartyRow({ party, canDelete, canManage }: { party: Party; canDelete: boolean; canManage: boolean }) {
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

  // A party nothing points at just goes. One with a ledger asks what to do with it first.
  const { start: startDelete, modal: deleteModal } = useDeleteWithRelated(del, {
    onError: (e) => setMsg(e.message),
  });

  const remove = () => {
    if (!confirm(`حذف ${party.name}؟`)) return;
    startDelete(party.id, party.name);
  };

  const otherRole: 'CLIENT' | 'SUPPLIER' = party.role === 'CLIENT' ? 'SUPPLIER' : 'CLIENT';
  // أصحاب العهد (PERSON) مالهمش ربط عميل↔مورد ولا عملة دولارية — بيتخفوا عنهم الحاجتين دول.
  const isPerson = party.role === 'PERSON';

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, fontWeight: 700, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          {party.name}
          {party.currency === 'USD' && <span className="pill" style={{ marginInlineStart: 6 }}>دولار</span>}
          {party.phone && <span className="muted" style={{ fontSize: 12, fontWeight: 400, marginInlineStart: 8 }}>{party.phone}</span>}
          {!isPerson && <LinkPanel party={party} canManage={canManage} otherRole={otherRole} />}
        </span>
        <span className={`num ${(party.balance ?? 0) >= 0 ? 'deb' : 'cre'}`} style={{ fontWeight: 700 }}>{EGP(party.balance)}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>{open ? 'إغلاق' : 'تعديل'}</button>
        {canDelete && <button className="btn btn-danger btn-sm" onClick={remove} disabled={del.isPending}>حذف</button>}
      </div>
      {open && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 130 }} />
          <input placeholder="تليفون" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ maxWidth: 140 }} />
          {!isPerson && (
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>
              <input type="checkbox" checked={currency === 'USD'} onChange={(e) => setCurrency(e.target.checked ? 'USD' : 'EGP')} />
              {party.role === 'CLIENT' ? 'عميل دولاري $' : 'مورد دولاري $'}
            </label>
          )}
          <MoneyInput value={opening} onChange={setOpening} placeholder="رصيد افتتاحي" style={{ maxWidth: 130 }} />
          <button className="btn btn-primary btn-sm" onClick={save} disabled={update.isPending}>حفظ</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>إلغاء</button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      )}
      {!open && msg && <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>{msg}</div>}
      {deleteModal}
    </div>
  );
}

type RegistryRole = 'CLIENT' | 'SUPPLIER' | 'PERSON';
const ROLE_LABEL: Record<RegistryRole, string> = { CLIENT: 'عميل', SUPPLIER: 'مورد', PERSON: 'صاحب عهدة' };

export function PartiesRegistry() {
  const { user, can } = useAuth();
  const [role, setRole] = useState<RegistryRole>('CLIENT');
  const [search, setSearch] = useState('');
  const { page, setPage, pageSize } = useTableState();
  const { data, isLoading } = useParties({ role, all: true });
  const createParty = useCreateParty();
  const [adding, setAdding] = useState(false);
  const [pName, setPName] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pCurrency, setPCurrency] = useState<'EGP' | 'USD'>('EGP');
  const [pErr, setPErr] = useState('');

  const canManage = !!user?.admin || can('settings');
  const roleLabel = ROLE_LABEL[role];
  const isPerson = role === 'PERSON';

  const addParty = () => {
    if (!pName.trim()) { setPErr('اكتب الاسم'); return; }
    setPErr('');
    createParty.mutate(
      // أصحاب العهد أطراف بدور PERSON بالجنيه — من غير نوع INVOICE ولا عملة دولارية.
      isPerson
        ? { name: pName.trim(), role, currency: 'EGP', phone: pPhone.trim() || undefined }
        : { name: pName.trim(), role, type: 'INVOICE', currency: pCurrency, phone: pPhone.trim() || undefined },
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
          options={[
            { value: 'CLIENT', label: 'العملاء' },
            { value: 'SUPPLIER', label: 'الموردين' },
            { value: 'PERSON', label: 'أصحاب العهد' },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم…" />
        {!adding && canManage && (
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>+ {roleLabel} جديد</button>
        )}
      </div>

      {adding && (
        <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input autoFocus placeholder={`اسم ال${roleLabel}`} value={pName} onChange={(e) => setPName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addParty(); if (e.key === 'Escape') setAdding(false); }}
            style={{ flex: 1, minWidth: 150 }} />
          <input placeholder="تليفون (اختياري)" value={pPhone} onChange={(e) => setPPhone(e.target.value)} style={{ maxWidth: 150 }} />
          {!isPerson && (
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>
              <input type="checkbox" checked={pCurrency === 'USD'} onChange={(e) => setPCurrency(e.target.checked ? 'USD' : 'EGP')} />
              {role === 'CLIENT' ? 'عميل دولاري $' : 'مورد دولاري $'}
            </label>
          )}
          <button className="btn btn-primary btn-sm" onClick={addParty} disabled={createParty.isPending}>حفظ</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setPName(''); setPErr(''); }}>إلغاء</button>
          {pErr && <span className="err-text">{pErr}</span>}
        </div>
      )}

      <div>
        {isLoading && <div className="empty">جاري التحميل…</div>}
        {!isLoading && pageRows.length === 0 && <div className="empty">لا يوجد</div>}
        {pageRows.map((p) => <PartyRow key={p.id} party={p} canDelete={!!user?.admin} canManage={canManage} />)}
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
