'use client';

import { useState } from 'react';
import { EGP } from '@/lib/format';
import { useCreatePartner } from '../hooks';
import type { Partner } from '../dtos';

/** ملخص طريقة التصفية كما تظهر على البطاقة. */
export function methodLabel(p: Partner) {
  return p.shareBasis === 'FIXED'
    ? 'تصفية ثابتة'
    : `رأس مال ${EGP(p.capital)}`;
}

/**
 * اختيار الاسم المطلوب تصفية حسابه. زر إضافة اسم جديد موجود هنا فقط، بجانب
 * البطاقات، ويفتح نموذجاً بالاسم وحده — باقي الإعدادات تُضبط بعد الإضافة.
 */
export function NameSelector({
  partners, picked, onPick, canAdd, onAdded,
}: {
  partners: Partner[];
  picked: string | null;
  onPick: (id: string) => void;
  canAdd?: boolean;
  onAdded: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div
        style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch',
          margin: '4px 0 14px',
        }}
      >
        {partners.map((p) => {
          const on = p.id === picked;
          return (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              title={p.suppliers.length ? `أصناف ${p.suppliers[0].name}` : 'كل الأصناف'}
              style={{
                textAlign: 'start',
                cursor: on ? 'default' : 'pointer',
                minWidth: 168,
                padding: '10px 14px',
                borderRadius: 'var(--radius)',
                border: `2px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
                background: on ? 'var(--accent-soft)' : 'var(--surface)',
                boxShadow: on ? 'var(--shadow)' : 'none',
                transition: 'border-color .15s, background .15s',
                opacity: p.active ? 1 : 0.55,
              }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 16, fontWeight: 800,
                  color: on ? 'var(--accent-d)' : 'var(--ink)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 9, height: 9, borderRadius: '50%',
                    background: on ? 'var(--accent)' : 'var(--line)',
                    flex: '0 0 auto',
                  }}
                />
                {p.name}
                {!p.active && <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>موقوف</span>}
              </div>
              {/* المورد يظهر فقط عند تحديده */}
              {!!p.suppliers.length && (
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{p.suppliers[0].name}</div>
              )}
              <div className="num" style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                {methodLabel(p)}
              </div>
            </button>
          );
        })}

        {canAdd && (
          <button
            onClick={() => setAdding((a) => !a)}
            title="إضافة اسم جديد إلى التصفية"
            style={{
              cursor: 'pointer',
              minWidth: 120,
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              border: `2px dashed ${adding ? 'var(--accent)' : 'var(--line)'}`,
              background: 'transparent',
              color: adding ? 'var(--accent-d)' : 'var(--ink-soft)',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {adding ? 'إلغاء' : '+ اسم جديد'}
          </button>
        )}
      </div>

      {adding && (
        <NewNameForm
          onDone={(id) => { setAdding(false); if (id) onAdded(id); }}
        />
      )}
    </>
  );
}

/** نموذج الإضافة: الاسم فقط، وباقي الإعدادات تُضبط من إعدادات التصفية بعدها. */
function NewNameForm({ onDone }: { onDone: (id?: string) => void }) {
  const create = useCreatePartner();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (!name.trim()) return setError('اكتب الاسم');
    setError('');
    create.mutate(
      { name: name.trim() },
      { onSuccess: (p: any) => onDone(p?.id), onError: (e: any) => setError(e.message) },
    );
  };

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <b style={{ display: 'block', marginBottom: 10 }}>اسم جديد</b>
      <div className="toolbar" style={{ marginBottom: 6 }}>
        <input
          autoFocus
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="اسم الشخص"
          style={{ padding: '10px 12px', border: '1.5px solid var(--line)', borderRadius: 10, minWidth: 220 }}
        />
        <button className="btn btn-primary" disabled={create.isPending || !name.trim()} onClick={submit}>
          {create.isPending ? '...' : 'إضافة'}
        </button>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        بعد الإضافة تُضبط باقي الإعدادات من «إعدادات التصفية»: طريقة التصفية، المورد،
        مصروف التشغيل، وحساب الدخول.
      </div>
      {error && <div className="err-text" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
