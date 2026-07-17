'use client';

import { useState } from 'react';
import { Field, Combobox } from '@/components/common';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuth } from '@/lib/auth';
import { useAllParties } from '../../parties/hooks';
import { useAllTreasury } from '../../treasury/hooks';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../hooks';
import type { User } from '../dtos';

const ALL_KEYS = PERMISSIONS.flatMap((g) => [g.page, ...g.actions.map((a) => a.key)]);

// نص "آخر ظهور" نسبي (من X دقيقة/ساعة/يوم)
function sinceText(iso?: string | null): string {
  if (!iso) return 'لم يدخل بعد';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'من لحظات';
  if (min < 60) return `من ${min} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `من ${hr} ساعة`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `من ${days} يوم`;
  return new Date(iso).toLocaleDateString('ar-EG');
}

// مؤشر أونلاين / آخر ظهور — للمالك فقط
function PresenceBadge({ user }: { user: User }) {
  return user.online ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: 'var(--credit)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--credit)', display: 'inline-block' }} />
      متصل الآن
    </span>
  ) : (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ink-soft)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--line)', display: 'inline-block' }} />
      آخر ظهور {sinceText(user.lastSeenAt)}
    </span>
  );
}

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

function MultiSelectPicker({ value, onChange, allItems, title, unitLabel, emptyHint, addPlaceholder }: {
  value: string[];
  onChange: (ids: string[]) => void;
  allItems: { id: string; name: string }[];
  title: string;
  unitLabel: string; // e.g. "عميل" / "خزينة"
  emptyHint: string;
  addPlaceholder: string;
}) {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const selected = allItems.filter((c) => value.includes(c.id));
  const available = allItems.filter((c) => !value.includes(c.id) && (!search || c.name.includes(search)));

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>
          {title}
          <span className="muted" style={{ fontWeight: 400, marginInlineStart: 8 }}>
            {value.length === 0 ? '(يشوف الكل)' : `${value.length} ${unitLabel}`}
          </span>
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {value.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onChange([]); setShowAdd(false); }}>
              مسح الكل
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowAdd((v) => !v); setSearch(''); }}>
            {showAdd ? '× إلغاء' : `+ إضافة ${unitLabel}`}
          </button>
        </div>
      </div>

      {/* assigned items table */}
      {selected.length === 0 && !showAdd && (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>{emptyHint}</p>
      )}
      {selected.length > 0 && (
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid var(--line)' }}>
              <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600, color: 'var(--muted)' }}>{unitLabel}</th>
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {selected.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                <td style={{ padding: '7px 8px' }}>{c.name}</td>
                <td style={{ textAlign: 'center', padding: '4px 8px' }}>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ fontSize: 12, padding: '3px 10px' }}
                    onClick={() => onChange(value.filter((id) => id !== c.id))}
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* add panel */}
      {showAdd && (
        <div style={{ marginTop: selected.length > 0 ? 10 : 0 }}>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={addPlaceholder}
            style={{ width: '100%', fontSize: 13, boxSizing: 'border-box' }}
          />
          {search && (
            <div style={{ maxHeight: 180, overflowY: 'auto', display: 'grid', gap: 2, marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, padding: 4 }}>
              {available.slice(0, 20).map((c) => (
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
              {available.length === 0 && (
                <p className="muted" style={{ fontSize: 12, margin: 0, padding: '4px 8px' }}>لا نتائج</p>
              )}
            </div>
          )}
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
  const { data: allParties } = useAllParties();
  const { data: treasuries } = useAllTreasury();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username ?? '');
  const [role, setRole] = useState<'STAFF' | 'CUSTOMER'>(user.role ?? 'STAFF');
  const [partyId, setPartyId] = useState(user.party?.id ?? '');
  const [admin, setAdmin] = useState(user.admin);
  const [views, setViews] = useState<string[]>(user.views);
  const [ledgerPartyIds, setLedgerPartyIds] = useState<string[]>(user.ledgerPartyIds ?? []);
  const [treasuryIds, setTreasuryIds] = useState<string[]>(user.treasuryIds ?? []);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [msg, setMsg] = useState('');

  const allClients = clients?.data ?? [];
  const ledgerParties = allParties?.data ?? [];
  const allTreasuries = treasuries?.data ?? [];
  const hasLedger = admin || views.includes('ledger');
  const hasTreasury = admin || views.includes('treasury');

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
          treasuryIds: role === 'STAFF' ? treasuryIds : [],
          ...(pin ? { pin } : {}),
        },
      },
      {
        onSuccess: (updated) => {
          setMsg('تم الحفظ ✓'); setPin('');
          if (me?.id === user.id) syncUser({
            name: updated.name, admin: updated.admin, views: updated.views,
            ledgerPartyIds: updated.ledgerPartyIds,
            treasuryIds: updated.treasuryIds,
            role: updated.role as any, partyId: updated.party?.id, partyName: updated.party?.name,
          });
        },
        onError: (e: any) => setMsg(e.message),
      },
    );
  };

  // The primary (owner) account can only be edited by the primary user themselves —
  // no other user (even an admin) can change its details, password, or delete it.
  const locked = !!user.isPrimary && !me?.isPrimary;

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <b style={{ flex: 1 }}>
          {user.name}
          {user.isPrimary && <span className="pill" style={{ background: 'var(--accent-soft)', color: 'var(--accent-d)' }}>المستخدم الأساسي</span>}
          {user.role === 'CUSTOMER' ? <span className="pill" style={{ background: 'var(--credit-bg)', color: 'var(--credit)' }}>عميل</span> : user.admin && <span className="pill">مدير</span>}
          {user.party && <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}> — {user.party.name}</span>}
        </b>
        {me?.isPrimary && <PresenceBadge user={user} />}
        {locked
          ? <span className="muted" style={{ fontSize: 12 }}>محمي — لا يمكن تعديله</span>
          : <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>{open ? 'إغلاق' : 'تعديل'}</button>}
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
                <MultiSelectPicker
                  value={ledgerPartyIds}
                  onChange={setLedgerPartyIds}
                  allItems={ledgerParties}
                  title="إخفاء أطراف من كشف الحساب"
                  unitLabel="طرف مخفي"
                  emptyHint="مفيش إخفاء — الموظف يشوف كل العملاء والموردين"
                  addPlaceholder="ابحث عن عميل أو مورد لإخفائه…"
                />
              )}
              {hasTreasury && (
                <MultiSelectPicker
                  value={treasuryIds}
                  onChange={setTreasuryIds}
                  allItems={allTreasuries}
                  title="الخزائن المسموح بها"
                  unitLabel="خزينة"
                  emptyHint="لا يوجد تقييد — الموظف يشوف ويصرف من كل الخزائن"
                  addPlaceholder="ابحث عن خزينة لإضافتها…"
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
  const { data: allParties } = useAllParties();
  const { data: treasuries } = useAllTreasury();
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
  const [treasuryIds, setTreasuryIds] = useState<string[]>([]);
  const [msg, setMsg] = useState('');

  const allClients = clients?.data ?? [];
  const ledgerParties = allParties?.data ?? [];
  const allTreasuries = treasuries?.data ?? [];
  const hasLedger = admin || views.includes('ledger');
  const hasTreasury = admin || views.includes('treasury');

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
          ? { partyId, admin: false, views: [], ledgerPartyIds: [], treasuryIds: [] }
          : { admin, views: admin ? [] : views, ledgerPartyIds: admin ? [] : ledgerPartyIds, treasuryIds: admin ? [] : treasuryIds }),
      },
      {
        onSuccess: () => { setName(''); setUsername(''); setPin(''); setAdmin(false); setViews(['dash']); setLedgerPartyIds([]); setTreasuryIds([]); setPartyId(''); setRole('STAFF'); setOpen(false); },
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
            <MultiSelectPicker
              value={ledgerPartyIds}
              onChange={setLedgerPartyIds}
              allItems={ledgerParties}
              title="كشف الحساب — عملاء/موردين مخصصين"
              unitLabel="طرف"
              emptyHint="لا يوجد تقييد — الموظف يشوف كل العملاء والموردين"
              addPlaceholder="ابحث عن عميل أو مورد لإضافته…"
            />
          )}
          {hasTreasury && (
            <MultiSelectPicker
              value={treasuryIds}
              onChange={setTreasuryIds}
              allItems={allTreasuries}
              title="الخزائن المسموح بها"
              unitLabel="خزينة"
              emptyHint="لا يوجد تقييد — الموظف يشوف ويصرف من كل الخزائن"
              addPlaceholder="ابحث عن خزينة لإضافتها…"
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
