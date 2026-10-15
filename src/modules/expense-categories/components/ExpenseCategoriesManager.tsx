'use client';

import { useState } from 'react';
import { ACTIVITY_LABEL, ActivityBadge, type Activity } from '@/lib/activity';
import { useAllExpenseCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../hooks';
import type { ExpenseCategory, ExpenseGroup } from '../dtos';

const GROUPS: { key: ExpenseGroup; label: string; icon: string }[] = [
  { key: 'WAREHOUSE', label: 'مصاريف مخزن', icon: '🏬' },
  { key: 'EXTERNAL', label: 'مصاريف خارجية', icon: '🚚' },
];

const ACTIVITIES: Activity[] = ['SHIPPING', 'TRADE', 'SHARED'];
const nextActivity = (a?: Activity): Activity => ACTIVITIES[(ACTIVITIES.indexOf(a ?? 'TRADE') + 1) % ACTIVITIES.length];

const selectStyle = { padding: '8px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 };

// addOnly: إضافة بند جديد فقط، بدون تعديل (التعديل من الإعدادات).
// allowDelete: يسمح بالحذف حتى مع addOnly (شاشة صرف وتوريد النقدية).
// onlyGroup: يعرض مجموعة واحدة فقط، والبند الجديد يتسجل فيها.
export function ExpenseCategoriesManager({ canManage, addOnly = false, allowDelete = false, onlyGroup }: {
  canManage: boolean; addOnly?: boolean; allowDelete?: boolean; onlyGroup?: ExpenseGroup;
}) {
  const { data: cats } = useAllExpenseCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [group, setGroup] = useState<ExpenseGroup>(onlyGroup ?? 'WAREHOUSE');
  const [activity, setActivity] = useState<Activity>(onlyGroup === 'EXTERNAL' ? 'TRADE' : 'SHIPPING');
  const [vehicleLink, setVehicleLink] = useState(false);
  const [goods, setGoods] = useState(false);
  const [err, setErr] = useState('');

  const rows = cats?.data ?? [];

  const submit = () => {
    if (!name.trim()) return setErr('اكتب اسم البند');
    setErr('');
    createCategory.mutate(
      { name: name.trim(), group: onlyGroup ?? group, addsToGoods: goods, activity, vehicleLink },
      {
        onSuccess: () => { setName(''); setGoods(false); setVehicleLink(false); setAdding(false); },
        onError: (e: any) => setErr(e.message),
      },
    );
  };

  const patch = (c: ExpenseCategory, dto: Partial<ExpenseCategory>) =>
    updateCategory.mutate({ id: c.id, dto: { name: c.name, ...dto } });

  const remove = (id: string, catName: string) => {
    if (!window.confirm(`حذف بند "${catName}"؟ لو البند مستخدم في حركات سابقة سيتم أرشفته بدل الحذف، وتبقى الحركات باسمه.`)) return;
    deleteCategory.mutate(id);
  };

  const editable = canManage && !addOnly;
  const deletable = canManage && (!addOnly || allowDelete);

  const chip = (c: ExpenseCategory) => (
    <span key={c.id} className="pill" style={{ display: 'flex', alignItems: 'center', gap: 6, ...(c.addsToGoods ? { background: 'var(--gold)', color: '#fff' } : {}) }}>
      {c.name}
      {editable ? (
        <button
          type="button" className="btn btn-ghost btn-sm" style={{ padding: 0 }}
          onClick={() => patch(c, { activity: nextActivity(c.activity) })}
          disabled={updateCategory.isPending}
          title="تغيير النشاط (شحن ← تجارة ← مشترك)"
        >
          <ActivityBadge activity={c.activity ?? 'TRADE'} />
        </button>
      ) : (
        <ActivityBadge activity={c.activity ?? 'TRADE'} />
      )}
      {editable ? (
        <button
          type="button" className="btn btn-ghost btn-sm"
          style={{ padding: '0 2px', fontSize: 12, opacity: c.vehicleLink ? 1 : 0.35 }}
          onClick={() => patch(c, { vehicleLink: !c.vehicleLink })}
          disabled={updateCategory.isPending}
          title={c.vehicleLink ? 'يُربط بعربية — اضغط للإلغاء' : 'ربط البند بعربية (تحميل/شفتنة)'}
        >🚛</button>
      ) : c.vehicleLink ? <span title="يُربط بعربية" style={{ fontSize: 12 }}>🚛</span> : null}
      {editable && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0 2px', fontSize: 11 }} onClick={() => patch(c, { group: c.group === 'EXTERNAL' ? 'WAREHOUSE' : 'EXTERNAL', addsToGoods: c.addsToGoods })} disabled={updateCategory.isPending} title="نقل إلى المجموعة الأخرى">⇄</button>
      )}
      {deletable && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0 2px', fontSize: 12, color: 'var(--debit)' }} onClick={() => remove(c.id, c.name)} disabled={deleteCategory.isPending} title="حذف البند">×</button>
      )}
    </span>
  );

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'grid', gap: 10, marginBottom: canManage ? 10 : 0 }}>
        {GROUPS.filter((g) => !onlyGroup || g.key === onlyGroup).map((grp) => {
          const items = rows.filter((c) => (c.group ?? 'WAREHOUSE') === grp.key);
          return (
            <div key={grp.key}>
              <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 5, color: 'var(--ink-soft)' }}>{grp.icon} {grp.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.length ? items.map(chip) : <span className="muted" style={{ fontSize: 12.5 }}>لا توجد بنود</span>}
              </div>
            </div>
          );
        })}
      </div>
      {canManage && (
        adding ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="اسم البند" style={{ maxWidth: 180 }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setAdding(false); setErr(''); } }}
            />
            {!onlyGroup && (
            <select
              value={group}
              onChange={(e) => {
                const g = e.target.value as ExpenseGroup;
                setGroup(g);
                setActivity(g === 'WAREHOUSE' ? 'SHIPPING' : 'TRADE');
              }}
              style={selectStyle}
            >
              {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
            )}
            <select value={activity} onChange={(e) => setActivity(e.target.value as Activity)} style={selectStyle} title="النشاط">
              {ACTIVITIES.map((a) => <option key={a} value={a}>{ACTIVITY_LABEL[a]}</option>)}
            </select>
            <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={vehicleLink} onChange={(e) => setVehicleLink(e.target.checked)} />
              يُربط بعربية
            </label>
            <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={goods} onChange={(e) => setGoods(e.target.checked)} />
              يُضاف على البضاعة
            </label>
            <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={createCategory.isPending}>حفظ</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setErr(''); }}>إلغاء</button>
            {err && <span className="err-text">{err}</span>}
          </div>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>+ بند جديد</button>
        )
      )}
    </div>
  );
}
