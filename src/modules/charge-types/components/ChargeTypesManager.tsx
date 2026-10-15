'use client';

import { useState } from 'react';
import { useChargeTypes, useCreateChargeType, useDeleteChargeType, useUpdateChargeType } from '../hooks';
import type { ChargeType } from '../dtos';

/** بنود الشحن على الفواتير — إضافة وتعديل الاسم والترتيب والحذف. */
export function ChargeTypesManager() {
  const { data } = useChargeTypes(true);
  const create = useCreateChargeType();
  const update = useUpdateChargeType();
  const remove = useDeleteChargeType();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [err, setErr] = useState('');

  const rows = data ?? [];
  const active = rows.filter((r) => !r.hidden);
  const archived = rows.filter((r) => r.hidden);

  const add = () => {
    if (!name.trim()) return setErr('اكتب اسم البند');
    setErr('');
    create.mutate({ name: name.trim() }, { onSuccess: () => setName(''), onError: (e: any) => setErr(e.message) });
  };

  const rename = () => {
    if (!editing?.name.trim()) return setErr('اكتب اسم البند');
    setErr('');
    update.mutate(
      { id: editing.id, dto: { name: editing.name.trim() } },
      { onSuccess: () => setEditing(null), onError: (e: any) => setErr(e.message) },
    );
  };

  const move = (c: ChargeType, dir: -1 | 1) => {
    const i = active.findIndex((x) => x.id === c.id);
    if (!active[i + dir]) return;
    // إعادة ترقيم القائمة كلها بالترتيب الجديد — أبسط من تبديل رقمين ممكن يكونوا متساويين.
    const order = [...active];
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    order.forEach((x, idx) => {
      if (x.sortOrder !== idx + 1) update.mutate({ id: x.id, dto: { sortOrder: idx + 1 } });
    });
  };

  const del = (c: ChargeType) => {
    const used = (c._count?.charges ?? 0) > 0;
    const msg = used
      ? `البند "${c.name}" مستخدم في ${c._count!.charges} فاتورة، لذلك سيتم أرشفته بدل الحذف. متابعة؟`
      : `حذف البند "${c.name}"؟`;
    if (!window.confirm(msg)) return;
    remove.mutate(c.id);
  };

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
      <div className="muted" style={{ fontSize: 13 }}>
        بنود الشحن تظهر في جدول «بنود الشحن» في الفاتورة، ولا تؤثر على المخزون. إجمالي الفاتورة = الأصناف + البنود.
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {active.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {editing?.id === c.id ? (
              <>
                <input
                  autoFocus value={editing.name} style={{ maxWidth: 200 }}
                  onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setEditing(null); }}
                />
                <button className="btn btn-primary btn-sm" onClick={rename} disabled={update.isPending}>حفظ</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>إلغاء</button>
              </>
            ) : (
              <>
                <span className="pill" style={{ minWidth: 110 }}>{c.name}</span>
                <span className="muted" style={{ fontSize: 12 }}>{c._count?.charges ?? 0} سطر</span>
                <button className="btn btn-ghost btn-sm" disabled={i === 0 || update.isPending} onClick={() => move(c, -1)} title="لأعلى">▲</button>
                <button className="btn btn-ghost btn-sm" disabled={i === active.length - 1 || update.isPending} onClick={() => move(c, 1)} title="لأسفل">▼</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ id: c.id, name: c.name })}>تعديل</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--debit)' }} onClick={() => del(c)} disabled={remove.isPending}>حذف</button>
              </>
            )}
          </div>
        ))}
        {!active.length && <span className="muted" style={{ fontSize: 13 }}>لا توجد بنود</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم بند جديد" style={{ maxWidth: 200 }}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
        />
        <button className="btn btn-ghost btn-sm" onClick={add} disabled={create.isPending}>+ إضافة بند</button>
        {err && <span className="err-text">{err}</span>}
      </div>
      {!!archived.length && (
        <div style={{ fontSize: 12.5 }}>
          <span className="muted">مؤرشفة: </span>
          {archived.map((c) => (
            <button
              key={c.id} className="btn btn-ghost btn-sm" title="استعادة"
              onClick={() => update.mutate({ id: c.id, dto: { hidden: false } })}
            >↺ {c.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}
