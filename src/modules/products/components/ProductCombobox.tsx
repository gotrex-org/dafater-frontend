'use client';

import { useEffect, useRef, useState } from 'react';
import { Field } from '@/components/common';
import { useCreateProduct } from '../hooks';
import type { Product } from '../dtos';

/**
 * The couple of details worth capturing while a product is being born mid-invoice.
 * Everything else (السعر، التثبيت، بند خدمة، …) stays on the الأصناف page.
 */
function NewProductModal({
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
    // The modal renders inside the combobox, which sits in an invoice-item table row —
    // stop the events there rather than letting them bubble into it.
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

/**
 * Type-ahead product picker. Filters products as you type and shows matches in a
 * dropdown; lets you create a new product on the fly. Reused by invoices and manifests.
 *
 * - id mode (default): `value` is a product id, `onChange` emits the picked id.
 * - freeText mode: `value`/`onChange` are the raw name string (used by manifests),
 *   and any typed text is kept even if it matches no product.
 *
 * Auto-create on blur: in id mode, if the user types a name and moves away without
 * picking from the dropdown, the component auto-selects an exact match or creates a
 * new product — no manual "add" click required. It stands down while the new-product
 * form is open, and for a name the user explicitly cancelled out of.
 *
 * allowCreate=false (freeText mode only): no "add new" suggestion is shown at all —
 * the dropdown is purely a filtered list of real catalog matches to help autofill,
 * and it never calls the create-product API. Typing is always the value regardless
 * of whether anything is picked from the list. Use for untrusted/anonymous callers
 * (e.g. the public order form) who shouldn't be able to write into the Product catalog.
 */
export function ProductCombobox({
  products,
  value,
  onChange,
  freeText = false,
  allowCreate = true,
  placeholder = 'اكتب أو اختر الصنف…',
}: {
  products: Product[];
  value: string;
  onChange: (v: string) => void;
  freeText?: boolean;
  allowCreate?: boolean;
  placeholder?: string;
}) {
  const createProduct = useCreateProduct();
  const [query, setQuery] = useState(() =>
    freeText ? value : (products.find((p) => p.id === value)?.name ?? ''),
  );
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [creatingName, setCreatingName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Read from inside the blur timeout, which closes over stale state — refs stay current.
  const modalOpen = useRef(false);
  const declined = useRef<string | null>(null);

  // في وضع الـid: لو الأصناف اتحمّلت بعد الفتح (تعديل فاتورة)، الاسم المعروض كان بيفضل فاضي
  // لأنه بيتحسب مرة واحدة. نزامنه لما القيمة/الأصناف تجهز (والمستخدم مش بيكتب — القيمة موجودة).
  useEffect(() => {
    if (freeText) return;
    const name = products.find((p) => p.id === value)?.name;
    if (name && name !== query) setQuery(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, products]);

  const q = query.trim().toLowerCase();
  const matches = (q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products).slice(0, 100);
  const exactProduct = q ? products.find((p) => p.name.toLowerCase() === q) : undefined;
  const canCreate = !!q && !exactProduct && allowCreate;

  const pick = (product: Product) => {
    onChange(freeText ? product.name : product.id);
    setQuery(product.name);
    setOpen(false);
  };

  const openCreate = () => { modalOpen.current = true; setCreatingName(query.trim()); setOpen(false); };

  const onInput = (v: string) => {
    setQuery(v);
    setOpen(true);
    setHi(0);
    if (freeText) onChange(v);
    else if (value) onChange('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation();
      if (!open) setOpen(true); else setHi((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      if (open) { e.preventDefault(); e.stopPropagation(); setHi((h) => Math.max(h - 1, 0)); }
    } else if (e.key === 'Enter') {
      // Enter picks the highlighted match; with nothing to pick it opens the new-product form.
      if (open && matches.length) {
        e.preventDefault(); e.stopPropagation();
        pick(matches[Math.min(hi, matches.length - 1)]);
      } else if (canCreate) {
        e.preventDefault(); e.stopPropagation();
        openCreate();
      } else if (freeText && query.trim()) {
        onChange(query.trim()); setOpen(false);
      }
    } else if (e.key === 'Escape') {
      if (open) { e.stopPropagation(); setOpen(false); }
    }
  };

  const onBlur = () => {
    setTimeout(() => {
      setOpen(false);
      // id mode only — nothing to do in freeText mode
      if (freeText || !query.trim() || value || pendingCreate) return;
      // the form is holding this name, or the user just backed out of creating it
      if (modalOpen.current || declined.current === query.trim()) return;
      if (exactProduct) {
        // exact name match → auto-select without creating
        onChange(exactProduct.id);
      } else {
        // new name → auto-create
        setPendingCreate(true);
        createProduct.mutate(
          { name: query.trim() },
          {
            onSuccess: (p) => { onChange(p.id); setQuery(p.name); setPendingCreate(false); },
            onError: () => setPendingCreate(false),
          },
        );
      }
    }, 120);
  };

  return (
    <div className="combo">
      <input
        ref={inputRef}
        value={query}
        placeholder={placeholder}
        onChange={(e) => onInput(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      {canCreate && (
        <button
          type="button"
          className="combo-create"
          // preventDefault keeps the field focused, so the query survives until the modal reads it
          onMouseDown={(e) => e.preventDefault()}
          onClick={openCreate}
        >
          ➕ <span>إضافة «{query.trim()}» كصنف جديد</span>
        </button>
      )}
      {open && matches.length > 0 && (
        <ul className={`combo-list${canCreate ? ' with-create' : ''}`}>
          {matches.map((product, i) => (
            <li
              key={product.id}
              className={i === hi ? 'hi' : ''}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(product); }}
            >
              {product.name}
            </li>
          ))}
        </ul>
      )}
      {creatingName !== null && (
        <NewProductModal
          initialName={creatingName}
          onCreated={(p) => {
            modalOpen.current = false;
            declined.current = null;
            onChange(freeText ? p.name : p.id);
            setQuery(p.name);
            setCreatingName(null);
            setOpen(false);
          }}
          onClose={() => {
            modalOpen.current = false;
            // don't let the blur handler silently create what was just cancelled
            declined.current = creatingName;
            setCreatingName(null);
            inputRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
