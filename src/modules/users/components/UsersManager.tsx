'use client';

import { useState } from 'react';
import { Field, Combobox } from '@/components/common';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuth } from '@/lib/auth';
import { useAllParties } from '../../parties/hooks';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../hooks';
import type { User } from '../dtos';

const ALL_KEYS = PERMISSIONS.flatMap((g) => [g.page, ...g.actions.map((a) => a.key)]);

function PermTree({ admin, views, setViews }: { admin: boolean; views: string[]; setViews: (v: string[]) => void }) {
  const has = (k: string) => views.includes(k);
  const togglePage = (page: string) => {
    if (has(page)) {
      const children = PERMISSIONS.find((g) => g.page === page)?.actions.map((a) => a.key) ?? [];
      setViews(views.filter((v) => v !== page && !children.includes(v)));
    } else setViews([...views, page]);
  };
  const toggleAction = (page: string, key: string) => {
    if (has(key)) setViews(views.filter((v) => v !== key));
    else setViews(Array.from(new Set([...views, key, page])));
  };
  return (
    <div style={{ display: 'grid', gap: 10, opacity: admin ? 0.5 : 1 }}>
      {PERMISSIONS.map((g) => (
        <div key={g.page} style={{ border: '1px solid var(--line-soft)', borderRadius: 8, padding: 8 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800 }}>
            <input type="checkbox" checked={admin || has(g.page)} disabled={admin} onChange={() => togglePage(g.page)} />
            {g.label}
          </label>
          {g.actions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6, paddingInlineStart: 24 }}>
              {g.actions.map((a) => (
                <label key={a.key} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 13.5 }}>
                  <input type="checkbox" checked={admin || has(a.key)} disabled={admin} onChange={() => toggleAction(g.page, a.key)} />
                  {a.label}
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LedgerPartyPicker({ value, onChange, allClients }: {
  value: string[];
  onChange: (ids: string[]) => void;
  allClients: { id: string; name: string }[];
}) {
  const [search, setSearch] = useState('');
  const selected = allClients.filter((c) => value.includes(c.id));
  const available = allClients.filter((c) => !value.includes(c.id) && c.name.includes(search));

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
        عملاء مخصصون في كشف الحساب
        <span style={{ marginRight: 6, fontWeight: 400 }}>({value.length === 0 ? 'يشوف الكل' : `${value.length} عميل`})</span>
      </div>

      {/* selected chips */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {selected.map((c) => (
            <span key={c.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 20,
              background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700,
            }}>
              {c.name}
              <button
                type="button"
                onClick={() => onChange(value.filter((id) => id !== c.id))}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 14 }}
              >×</button>
            </span>
          ))}
        </div>
      )}

      {/* search + add */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن عميل لإضافته…"
          style={{ flex: 1, fontSize: 13 }}
        />
        {value.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([])}>إزالة الكل</button>
        )}
      </div>

      {search && (
        <div style={{ maxHeight: 140, overflowY: 'auto', display: 'grid', gap: 2 }}>
          {available.slice(0, 15).map((c) => (
            <button
              key={c.id}
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ textAlign: 'right', justifyContent: 'flex-start' }}
              onClick={() => { onChange([...value, c.id]); setSearch(''); }}
            >
              + {c.name}
            </button>
          ))}
          {available.length === 0 && <div className="muted" style={{ fontSize: 12, padding: '4px 8px' }}>لا نتائج</div>}
        </div>
      )}
    </div>
  );
}

function UserRow({ user, canDelete }: { user: User; canDelete: boolean }) {
  const { user: me, syncUser } = useAuth();
  const update = useUpdateUser();
  const del = useDeleteUser();
  const { data: clients } = useAllParties('CLIENT');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username ?? '');
  const [role, setRole] = useState<'STAFF' | 'CUSTOMER'>(user.role ?? 'STAFF');
  const [partyId, setPartyId] = useState(user.party?.id ?? '');
  const [admin, setAdmin] = useState(user.admin);
  const [views, setViews] = useState<string[]>(user.views);
  const [ledgerPartyIds, setLedgerPartyIds] = useState<string[]>(user.ledgerPartyIds ?? []);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [msg, setMsg] = useState('');

  const allClients = clients?.data ?? [];
  const hasLedger = admin || views.includes('ledger');

  const save = () => {
    setMsg('');
    if (!name.trim()) return setMsg('اكتب الاسم');
    update.mutate(
      {
        id: user.id,
        dto: {
          name: name.trim(),
          username: username.trim() || undefined,
          role,
          partyId: role === 'CUSTOMER' ? partyId || undefined : undefined,
          admin: role === 'STAFF' ? admin : false,
          views: role === 'STAFF' ? views : [],
          ledgerPartyIds: role === 'STAFF' ? ledgerPartyIds : [],
          ...(pin ? { pin } : {}),
        },
      },
      {
        onSuccess: (updated) => {
          setMsg('تم الحفظ ✓'); setPin('');
          if (me?.id === user.id) syncUser({
            name: updated.name, admin: updated.admin, views: updated.views,
            ledgerPartyIds: updated.ledgerPartyIds,
            role: updated.role as any, partyId: updated.party?.id, partyName: updated.party?.name,
          });
        },
        onError: (e: any) => setMsg(e.message),
      },
    );
  };

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <b style={{ flex: 1 }}>
          {user.name}
          {user.role === 'CUSTOMER' ? <span className="pill" style={{ background: 'var(--credit-bg)', color: 'var(--credit)' }}>عميل</span> : user.admin && <span className="pill">مدير</span>}
          {user.party && <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}> — {user.party.name}</span>}
        </b>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>{open ? 'إغلاق' : 'تعديل'}</button>
      </div>
      {open && (
        <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input placeholder="الاسم (للعرض)" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 160 }} />
            <input placeholder="يوزر نيم للدخول" value={username} onChange={(e) => setUsername(e.target.value)} style={{ maxWidth: 160 }} />
            <select value={role} onChange={(e) => setRole(e.target.value as any)} style={{ padding: '10px 12px', border: '1.5px solid var(--line)', borderRadius: 10 }}>
              <option value="STAFF">موظف</option>
              <option value="CUSTOMER">عميل (بورتال)</option>
            </select>
            {role === 'CUSTOMER' && (
              <div style={{ minWidth: 200 }}>
                <Combobox options={clients?.data ?? []} value={partyId} onChange={setPartyId} placeholder="ربط بعميل…" />
              </div>
            )}
          </div>

          {role === 'STAFF' && (
            <>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
                <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
                مدير (كل الصلاحيات)
              </label>
              {!admin && (
                <div className="toolbar" style={{ marginBottom: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setViews(ALL_KEYS)}>تحديد الكل</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setViews([])}>إلغاء الكل</button>
                </div>
              )}
              <PermTree admin={admin} views={views} setViews={setViews} />
              {hasLedger && (
                <LedgerPartyPicker
                  value={ledgerPartyIds}
                  onChange={setLedgerPartyIds}
                  allClients={allClients}
                />
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <input type={showPin ? 'text' : 'password'} placeholder="رقم سري جديد (اختياري)" value={pin} onChange={(e) => setPin(e.target.value)} style={{ maxWidth: 180 }} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPin((s) => !s)}>{showPin ? '🙈' : '👁'}</button>
            </div>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={update.isPending}>حفظ</button>
            {canDelete && (
              <button className="btn btn-danger btn-sm" onClick={() => del.mutate(user.id)} disabled={del.isPending}>حذف</button>
            )}
            {msg && <span className="muted">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function NewUser() {
  const create = useCreateUser();
  const { data: clients } = useAllParties('CLIENT');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [role, setRole] = useState<'STAFF' | 'CUSTOMER'>('STAFF');
  const [partyId, setPartyId] = useState('');
  const [admin, setAdmin] = useState(false);
  const [views, setViews] = useState<string[]>(['dash']);
  const [ledgerPartyIds, setLedgerPartyIds] = useState<string[]>([]);
  const [msg, setMsg] = useState('');

  const allClients = clients?.data ?? [];
  const hasLedger = admin || views.includes('ledger');

  const submit = () => {
    setMsg('');
    if (!name.trim()) return setMsg('اكتب الاسم');
    if (!username.trim()) return setMsg('اكتب اليوزر نيم');
    if (!pin) return setMsg('اكتب كلمة المرور');
    if (role === 'CUSTOMER' && !partyId) return setMsg('اختر العميل المرتبط');
    create.mutate(
      {
        name: name.trim(), username: username.trim(), pin, role,
        ...(role === 'CUSTOMER'
          ? { partyId, admin: false, views: [], ledgerPartyIds: [] }
          : { admin, views: admin ? [] : views, ledgerPartyIds: admin ? [] : ledgerPartyIds }),
      },
      {
        onSuccess: () => { setName(''); setUsername(''); setPin(''); setAdmin(false); setViews(['dash']); setLedgerPartyIds([]); setPartyId(''); setRole('STAFF'); setOpen(false); },
        onError: (e: any) => setMsg(e.message),
      },
    );
  };

  if (!open) return <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>+ مستخدم جديد</button>;

  return (
    <div style={{ border: '1.5px dashed var(--line)', borderRadius: 10, padding: 12, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="الاسم (للعرض)"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="يوزر نيم"><input value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
        <Field label="كلمة المرور">
          <div style={{ display: 'flex', gap: 4 }}>
            <input type={showPin ? 'text' : 'password'} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="كلمة المرور" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPin((s) => !s)}>{showPin ? '🙈' : '👁'}</button>
          </div>
        </Field>
        <Field label="نوع الحساب">
          <select value={role} onChange={(e) => setRole(e.target.value as any)} style={{ padding: '10px 12px', border: '1.5px solid var(--line)', borderRadius: 10 }}>
            <option value="STAFF">موظف</option>
            <option value="CUSTOMER">عميل (بورتال)</option>
          </select>
        </Field>
        {role === 'CUSTOMER' && (
          <Field label="ربط بعميل">
            <div style={{ minWidth: 220 }}>
              <Combobox options={clients?.data ?? []} value={partyId} onChange={setPartyId} placeholder="اختر العميل…" />
            </div>
          </Field>
        )}
      </div>

      {role === 'STAFF' && (
        <>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
            <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} /> مدير (كل الصلاحيات)
          </label>
          <PermTree admin={admin} views={views} setViews={setViews} />
          {hasLedger && (
            <LedgerPartyPicker
              value={ledgerPartyIds}
              onChange={setLedgerPartyIds}
              allClients={allClients}
            />
          )}
        </>
      )}

      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={create.isPending}>إنشاء</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>إلغاء</button>
        {msg && <span className="err-text">{msg}</span>}
      </div>
    </div>
  );
}

export function UsersManager() {
  const { data } = useUsers();
  const users = data?.data ?? [];
  return (
    <div className="section">
      <h2>المستخدمون والصلاحيات</h2>
      <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
        {users.map((u) => <UserRow key={u.id} user={u} canDelete={users.length > 1} />)}
        <NewUser />
      </div>
    </div>
  );
}
