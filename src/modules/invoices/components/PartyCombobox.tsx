'use client';

import { useEffect, useState } from 'react';
import { useCreateParty } from '../../parties/hooks';
import type { Party, PartyRole } from '../../parties/dtos';

type Opt = { kind: 'party'; party: Party } | { kind: 'create'; name: string };

/**
 * Searchable party picker with inline "create new" — type to filter clients/
 * suppliers/agents, or add a brand-new one on the fly. Used by invoices & deals.
 */
export function PartyCombobox({
  parties,
  value,
  onChange,
  role,
}: {
  parties: Party[];
  value: string;
  onChange: (id: string) => void;
  role: PartyRole;
}) {
  const createParty = useCreateParty();
  const label = role === 'CLIENT' ? 'عميل' : role === 'SUPPLIER' ? 'مورد' : 'طرف';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hi, setHi] = useState(0);

  useEffect(() => {
    if (!focused) { setQuery(parties.find((p) => p.id === value)?.name ?? ''); setSearching(false); }
  }, [value, parties, focused]);

  const q = searching ? query.trim().toLowerCase() : '';
  const matches = (q ? parties.filter((p) => p.name.toLowerCase().includes(q)) : parties).slice(0, 50);
  const hasExact = !!q && parties.some((p) => p.name.toLowerCase() === q);
  const options: Opt[] = [
    ...matches.map((party) => ({ kind: 'party' as const, party })),
    ...(q && !hasExact ? [{ kind: 'create' as const, name: query.trim() }] : []),
  ];

  const commit = (o: Opt) => {
    if (o.kind === 'party') { onChange(o.party.id); setQuery(o.party.name); setOpen(false); setSearching(false); }
    else createParty.mutate(
      { name: o.name, role, type: 'INVOICE' },
      { onSuccess: (p) => { onChange(p.id); setQuery(p.name); setOpen(false); } },
    );
  };

  const onInput = (v: string) => { setQuery(v); setSearching(true); setOpen(true); setHi(0); if (value) onChange(''); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); if (!open) setOpen(true); else setHi((h) => Math.min(h + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { if (open) { e.preventDefault(); e.stopPropagation(); setHi((h) => Math.max(h - 1, 0)); } }
    else if (e.key === 'Enter') { if (open && options.length) { e.preventDefault(); e.stopPropagation(); commit(options[Math.min(hi, options.length - 1)]); } }
    else if (e.key === 'Escape') { if (open) { e.stopPropagation(); setOpen(false); } }
  };

  return (
    <div className="combo">
      <input
        value={query}
        placeholder={`اكتب أو اختر ${label}…`}
        onChange={(e) => onInput(e.target.value)}
        onFocus={(e) => { setFocused(true); setOpen(true); setSearching(false); e.target.select(); }}
        onClick={(e) => { setOpen(true); setSearching(false); (e.target as HTMLInputElement).select(); }}
        onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 120); }}
        onKeyDown={onKeyDown}
      />
      {open && options.length > 0 && (
        <ul className="combo-list">
          {options.map((o, i) => (
            <li key={o.kind === 'party' ? o.party.id : '__create__'} className={i === hi ? 'hi' : ''} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); commit(o); }}>
              {o.kind === 'party' ? o.party.name : <span className="muted">➕ إضافة «{o.name}» كـ{label} جديد</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
