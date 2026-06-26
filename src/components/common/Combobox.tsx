'use client';

import { useEffect, useState } from 'react';

export interface ComboItem { id: string; name: string; }

/**
 * Generic type-ahead dropdown over an {id,name}[] list. Same look/feel as the
 * product picker but without inline creation — for choosing an existing record.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'اكتب أو اختر…',
}: {
  options: ComboItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hi, setHi] = useState(0);

  // reflect the selected value's name whenever we're not actively typing
  useEffect(() => {
    if (!focused) { setQuery(options.find((o) => o.id === value)?.name ?? ''); setSearching(false); }
  }, [value, options, focused]);

  const q = searching ? query.trim().toLowerCase() : '';
  const matches = (q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options).slice(0, 50);

  const pick = (o: ComboItem) => { onChange(o.id); setQuery(o.name); setOpen(false); setSearching(false); };
  const onInput = (v: string) => { setQuery(v); setSearching(true); setOpen(true); setHi(0); if (value) onChange(''); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation();
      if (!open) setOpen(true); else setHi((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      if (open) { e.preventDefault(); e.stopPropagation(); setHi((h) => Math.max(h - 1, 0)); }
    } else if (e.key === 'Enter') {
      if (open && matches[hi]) { e.preventDefault(); e.stopPropagation(); pick(matches[hi]); }
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
        onFocus={(e) => { setFocused(true); setOpen(true); setSearching(false); e.target.select(); }}
        onClick={(e) => { setOpen(true); setSearching(false); (e.target as HTMLInputElement).select(); }}
        onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 120); }}
        onKeyDown={onKeyDown}
      />
      {open && matches.length > 0 && (
        <ul className="combo-list">
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
