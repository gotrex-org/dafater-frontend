'use client';

import { useEffect, useState } from 'react';
import { useCreateProduct } from '../hooks';
import type { Product } from '../dtos';

type Opt = { kind: 'product'; product: Product } | { kind: 'create'; name: string };

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
 * new product — no manual "add" click required.
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
  const hasExact = !!exactProduct;

  const options: Opt[] = [
    ...matches.map((product) => ({ kind: 'product' as const, product })),
    ...(q && !hasExact && allowCreate ? [{ kind: 'create' as const, name: query.trim() }] : []),
  ];

  const commit = (opt: Opt) => {
    if (opt.kind === 'product') {
      onChange(freeText ? opt.product.name : opt.product.id);
      setQuery(opt.product.name);
      setOpen(false);
    } else {
      setPendingCreate(true);
      createProduct.mutate(
        { name: opt.name },
        {
          onSuccess: (p) => { onChange(freeText ? p.name : p.id); setQuery(p.name); setOpen(false); setPendingCreate(false); },
          onError: () => setPendingCreate(false),
        },
      );
    }
  };

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
      if (!open) setOpen(true); else setHi((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      if (open) { e.preventDefault(); e.stopPropagation(); setHi((h) => Math.max(h - 1, 0)); }
    } else if (e.key === 'Enter') {
      if (open && options.length) {
        e.preventDefault(); e.stopPropagation();
        commit(options[Math.min(hi, options.length - 1)]);
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
        value={query}
        placeholder={placeholder}
        onChange={(e) => onInput(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      {open && options.length > 0 && (
        <ul className="combo-list">
          {options.map((opt, i) => (
            <li
              key={opt.kind === 'product' ? opt.product.id : '__create__'}
              className={i === hi ? 'hi' : ''}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => { e.preventDefault(); commit(opt); }}
            >
              {opt.kind === 'product'
                ? opt.product.name
                : <span className="muted">➕ إضافة «{opt.name}» كصنف جديد</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
