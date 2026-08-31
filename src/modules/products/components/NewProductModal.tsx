'use client';

import { useState } from 'react';
import { Field } from '@/components/common';
import { useCreateProduct } from '../hooks';
import type { Product } from '../dtos';

/**
 * The couple of details worth capturing while a product is being born mid-entry, from
 * wherever a product gets picked. Everything else (السعر، التثبيت، بند خدمة، …) stays
 * on the الأصناف page.
 *
 * It renders inside whatever field opened it — usually a cell of the invoice-items
 * table — so it stops its own mouse events rather than letting them bubble into it.
 */
export function NewProductModal({
  initialName,
  onCreated,
  onClose,
}: {
  initialName: string;
  onCreated: (p: Product) => void;
  onClose: () => void;
}) {
  const createProduct = useCreateProduct();
  const [name, setName] = useState(initialName);
  const [unit, setUnit] = useState('');
  const [error, setError] = useState('');

  const save = () => {
    const n = name.trim();
    if (!n) return setError('اكتب اسم الصنف');
    setError('');
    createProduct.mutate(
      { name: n, unit: unit.trim() || undefined },
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
          <b>صنف جديد</b>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <Field label="الاسم">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKeyDown} />
          </Field>
          <Field label="الوحدة">
            <input value={unit} placeholder="اختياري — طن، شيكارة، كرتونة…" onChange={(e) => setUnit(e.target.value)} onKeyDown={onKeyDown} />
          </Field>
          {error && <div className="err-text">{error}</div>}
        </div>
        <div className="toolbar" style={{ padding: '12px 16px' }}>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={createProduct.isPending}>
            {createProduct.isPending ? '...' : 'حفظ'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
