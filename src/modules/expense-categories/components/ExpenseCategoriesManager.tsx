'use client';

import { useState } from 'react';
import { useAllExpenseCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../hooks';

export function ExpenseCategoriesManager({ canManage }: { canManage: boolean }) {
  const { data: cats } = useAllExpenseCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [goods, setGoods] = useState(false);
  const [err, setErr] = useState('');

  const rows = cats?.data ?? [];

  const submit = () => {
    if (!name.trim()) return setErr('اكتب اسم البند');
    setErr('');
    createCategory.mutate(
      { name: name.trim(), addsToGoods: goods },
      { onSuccess: () => { setName(''); setGoods(false); setAdding(false); }, onError: (e: any) => setErr(e.message) },
    );
  };

  const toggleGoods = (c: { id: string; name: string; addsToGoods?: boolean }) =>
    updateCategory.mutate({ id: c.id, dto: { name: c.name, addsToGoods: !c.addsToGoods } });

  const remove = (id: string, catName: string) => {
    if (!window.confirm(`حذف بند "${catName}"؟ الحركات القديمة المسجلة عليه هتفضل موجودة بدون بند.`)) return;
    deleteCategory.mutate(id);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: canManage ? 8 : 0 }}>
        {rows.map((c) => (
          <span key={c.id} className="pill" style={{ display: 'flex', alignItems: 'center', gap: 6, ...(c.addsToGoods ? { background: 'var(--gold)', color: '#fff' } : {}) }}>
            {c.name}
            {c.addsToGoods && <span style={{ fontSize: 10 }}>· على البضاعة</span>}
            {canManage && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '0 2px', fontSize: 11 }}
                onClick={() => toggleGoods(c)}
                disabled={updateCategory.isPending}
                title={c.addsToGoods ? 'اجعله مصروف تشغيلي' : 'اجعله يُضاف على البضاعة'}
              >⇄</button>
            )}
            {canManage && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '0 2px', fontSize: 12, color: 'var(--debit)' }}
                onClick={() => remove(c.id, c.name)}
                disabled={deleteCategory.isPending}
                title="حذف البند"
              >×</button>
            )}
          </span>
        ))}
        {rows.length === 0 && <span className="muted" style={{ fontSize: 13 }}>لا توجد بنود بعد</span>}
      </div>
      {canManage && (
        adding ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="اسم البند" style={{ maxWidth: 180 }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setAdding(false); setErr(''); } }}
            />
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
