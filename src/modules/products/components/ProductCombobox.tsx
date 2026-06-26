'use client';

import { useState } from 'react';
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
 */
export function ProductCombobox({
  products,
  value,
  onChange,
  freeText = false,
  placeholder = 'اكتب أو اختر الصنف…',
}: {
  products: Product[];
  value: string;
  onChange: (v: string) => void;
  freeText?: boolean;
  placeholder?: string;
}) {
  const createProduct = useCreateProduct();
  const [query, setQuery] = useState(() =>
    freeText ? value : (products.find((p) => p.id === value)?.name ?? ''),
  );
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);

  const q = query.trim().toLowerCase();
  const matches = (q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products).slice(0, 100);
  const hasExact = !!q && products.some((p) => p.name.toLowerCase() === q);

  const options: Opt[] = [
    ...matches.map((product) => ({ kind: 'product' as const, product })),
    ...(q && !hasExact ? [{ kind: 'create' as const, name: query.trim() }] : []),
  ];

  const commit = (opt: Opt) => {
    if (opt.kind === 'product') {
      onChange(freeText ? opt.product.name : opt.product.id);
      setQuery(opt.product.name);
      setOpen(false);
    } else {
      createProduct.mutate(
        { name: opt.name },
        { onSuccess: (p) => { onChange(freeText ? p.name : p.id); setQuery(p.name); setOpen(false); } },
      );
    }
  };

  const onInput = (v: string) => {
    setQuery(v);
    setOpen(true);
    setHi(0);
    if (freeText) onChange(v);          // keep raw text live for manifests
    else if (value) onChange('');       // typing invalidates a prior id selection
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
        onChange(query.trim()); setOpen(false); // let Enter bubble to move to next field
      }
    } else if (e.key === 'Escape') {
      if (open) { e.stopPropagation(); setOpen(false); }
    }
  };

  return (
    <div className="combo">
      <input
        value={query}
        placeholder={placeholder}
        onChange={(e) => onInput(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
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
