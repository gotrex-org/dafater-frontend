'use client';

import { useState } from 'react';
import { useAllExpenseCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../hooks';
import type { ExpenseCategory, ExpenseGroup } from '../dtos';

const GROUPS: { key: ExpenseGroup; label: string; icon: string }[] = [
  { key: 'WAREHOUSE', label: 'مصاريف مخزن', icon: '🏬' },
  { key: 'EXTERNAL', label: 'مصاريف خارجية', icon: '🚚' },
];

// addOnly: يسمح بإضافة بند جديد بس، من غير تعديل/حذف (التعديل والحذف من الإعدادات).
export function ExpenseCategoriesManager({ canManage, addOnly = false }: { canManage: boolean; addOnly?: boolean }) {
  const { data: cats } = useAllExpenseCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [group, setGroup] = useState<ExpenseGroup>('WAREHOUSE');
  const [goods, setGoods] = useState(false);
  const [err, setErr] = useState('');

  const rows = cats?.data ?? [];

  const submit = () => {
    if (!name.trim()) return setErr('اكتب اسم البند');
    setErr('');
    createCategory.mutate(
      { name: name.trim(), group, addsToGoods: goods },
      { onSuccess: () => { setName(''); setGoods(false); setAdding(false); }, onError: (e: any) => setErr(e.message) },
    );
  };

  const moveGroup = (c: ExpenseCategory) =>
    updateCategory.mutate({ id: c.id, dto: { name: c.name, group: c.group === 'EXTERNAL' ? 'WAREHOUSE' : 'EXTERNAL', addsToGoods: c.addsToGoods } });

  const remove = (id: string, catName: string) => {
    if (!window.confirm(`حذف بند "${catName}"؟ الحركات القديمة المسجلة عليه هتفضل موجودة بدون بند.`)) return;
    deleteCategory.mutate(id);
  };

  const chip = (c: ExpenseCategory) => (
    <span key={c.id} className="pill" style={{ display: 'flex', alignItems: 'center', gap: 6, ...(c.addsToGoods ? { background: 'var(--gold)', color: '#fff' } : {}) }}>
      {c.name}
      {canManage && !addOnly && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0 2px', fontSize: 11 }} onClick={() => moveGroup(c)} disabled={updateCategory.isPending} title="نقل للمجموعة التانية">⇄</button>
      )}
      {canManage && !addOnly && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0 2px', fontSize: 12, color: 'var(--debit)' }} onClick={() => remove(c.id, c.name)} disabled={deleteCategory.isPending} title="حذف البند">×</button>
      )}
    </span>
  );

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'grid', gap: 10, marginBottom: canManage ? 10 : 0 }}>
        {GROUPS.map((grp) => {
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
            <select value={group} onChange={(e) => setGroup(e.target.value as ExpenseGroup)} style={{ padding: '8px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }}>
              {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
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
