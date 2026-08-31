'use client';

import { useEffect, useRef, useState } from 'react';
import { normalizeAr } from '@/lib/arabicSearch';

export interface ComboItem { id: string; name: string; }

/**
 * Append a just-created record to an options list. A freshly added party/product isn't
 * in the server list until react-query refetches, and without it the field would blank
 * out for a beat — the effect below resolves the selected id against `options`.
 */
export function withAdded<T extends ComboItem>(options: T[], added: T | null): T[] {
  return added && !options.some((o) => o.id === added.id) ? [...options, added] : options;
}

/**
 * Generic type-ahead dropdown over an {id,name}[] list — for choosing an existing record.
 *
 * Pass `onCreate` to also offer "add a new one" when what's typed matches nothing: a
 * button appears pinned under the field (and Enter with no match triggers it) carrying
 * `createLabel`, e.g. "كعميل جديد". The caller decides what happens — normally opening
 * NewPartyModal / NewProductModal — so each field keeps its own option list (a
 * warehouse's stock, USD suppliers, non-service products, …) instead of the full catalog.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'اكتب أو اختر…',
  onCreate,
  createLabel = 'جديد',
}: {
  options: ComboItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  onCreate?: (name: string) => void;
  createLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // reflect the selected value's name whenever we're not actively typing
  useEffect(() => {
    if (!focused) { setQuery(options.find((o) => o.id === value)?.name ?? ''); setSearching(false); }
  }, [value, options, focused]);

  const q = searching ? normalizeAr(query) : '';
  const matches = (q ? options.filter((o) => normalizeAr(o.name).includes(q)) : options).slice(0, 50);
  const hasExact = !!q && options.some((o) => normalizeAr(o.name) === q);
  const canCreate = !!onCreate && !!q && !hasExact;

  const pick = (o: ComboItem) => { onChange(o.id); setQuery(o.name); setOpen(false); setSearching(false); };
  const onInput = (v: string) => { setQuery(v); setSearching(true); setOpen(true); setHi(0); if (value) onChange(''); };
  const openCreate = () => { onCreate?.(query.trim()); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation();
      if (!open) setOpen(true); else setHi((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      if (open) { e.preventDefault(); e.stopPropagation(); setHi((h) => Math.max(h - 1, 0)); }
    } else if (e.key === 'Enter') {
      // Enter picks the highlighted match; with nothing to pick it starts a new record.
      if (open && matches[hi]) { e.preventDefault(); e.stopPropagation(); pick(matches[hi]); }
      else if (canCreate) { e.preventDefault(); e.stopPropagation(); openCreate(); }
    } else if (e.key === 'Escape') {
      if (open) { e.stopPropagation(); setOpen(false); }
    }
  };

  return (
    <div className="combo">
      <input
        ref={inputRef}
        value={query}
        placeholder={placeholder}
        onChange={(e) => onInput(e.target.value)}
        onFocus={(e) => { setFocused(true); setOpen(true); setSearching(false); e.target.select(); }}
        onClick={(e) => { setOpen(true); setSearching(false); (e.target as HTMLInputElement).select(); }}
        onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 120); }}
        onKeyDown={onKeyDown}
      />
      {canCreate && (
        <button
          type="button"
          className="combo-create"
          // preventDefault keeps the field focused, so the query survives until the form reads it
          onMouseDown={(e) => e.preventDefault()}
          onClick={openCreate}
        >
          ➕ <span>إضافة «{query.trim()}» {createLabel}</span>
        </button>
      )}
      {open && matches.length > 0 && (
        <ul className={`combo-list${canCreate ? ' with-create' : ''}`}>
          {matches.map((o, i) => (
            <li key={o.id} className={i === hi ? 'hi' : ''} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); pick(o); }}>
              {o.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
