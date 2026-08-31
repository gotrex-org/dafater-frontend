'use client';

import { useEffect, useRef, useState } from 'react';
import { normalizeAr } from '@/lib/arabicSearch';
import { NewPartyModal } from '../../parties/components/NewPartyModal';
import type { Party, PartyRole } from '../../parties/dtos';

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
  // The picked party comes along so callers that mirror its name (كشف العربية، رحلة السائق)
  // can read it even for one just created, before the server list refetches.
  onChange: (id: string, party?: Party) => void;
  role: PartyRole;
}) {
  const label = role === 'CLIENT' ? 'عميل' : role === 'SUPPLIER' ? 'مورد' : 'طرف';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hi, setHi] = useState(0);
  const [creatingName, setCreatingName] = useState<string | null>(null);
  // Parties added from the modal. The server list is refetched asynchronously, so
  // without keeping them here the field would blank out for a beat right after saving.
  const [added, setAdded] = useState<Party[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = added.length
    ? [...parties, ...added.filter((a) => !parties.some((p) => p.id === a.id))]
    : parties;

  useEffect(() => {
    // Don't reclaim the field while the modal owns the interaction.
    if (focused || creatingName !== null) return;
    const picked = parties.find((p) => p.id === value) ?? added.find((p) => p.id === value);
    setQuery(picked?.name ?? '');
    setSearching(false);
  }, [value, parties, added, focused, creatingName]);

  const q = searching ? normalizeAr(query) : '';
  const matches = (q ? all.filter((p) => normalizeAr(p.name).includes(q)) : all).slice(0, 50);
  const hasExact = !!q && all.some((p) => normalizeAr(p.name) === q);
  const canCreate = !!q && !hasExact;

  const pick = (party: Party) => { onChange(party.id, party); setQuery(party.name); setOpen(false); setSearching(false); };

  const openCreate = () => { setCreatingName(query.trim()); setOpen(false); };

  const onInput = (v: string) => { setQuery(v); setSearching(true); setOpen(true); setHi(0); if (value) onChange(''); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); if (!open) setOpen(true); else setHi((h) => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { if (open) { e.preventDefault(); e.stopPropagation(); setHi((h) => Math.max(h - 1, 0)); } }
    else if (e.key === 'Enter') {
      // Enter picks the highlighted match; with nothing to pick it opens the new-party form.
      if (open && matches.length) { e.preventDefault(); e.stopPropagation(); pick(matches[Math.min(hi, matches.length - 1)]); }
      else if (canCreate) { e.preventDefault(); e.stopPropagation(); openCreate(); }
    }
    else if (e.key === 'Escape') { if (open) { e.stopPropagation(); setOpen(false); } }
  };

  return (
    <div className="combo">
      <input
        ref={inputRef}
        value={query}
        placeholder={`اكتب أو اختر ${label}…`}
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
          // preventDefault keeps the field focused, so the query survives until the modal reads it
          onMouseDown={(e) => e.preventDefault()}
          onClick={openCreate}
        >
          ➕ <span>إضافة «{query.trim()}» كـ{label} جديد</span>
        </button>
      )}
      {open && matches.length > 0 && (
        <ul className={`combo-list${canCreate ? ' with-create' : ''}`}>
          {matches.map((party, i) => (
            <li key={party.id} className={i === hi ? 'hi' : ''} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); pick(party); }}>
              {party.name}
            </li>
          ))}
        </ul>
      )}
      {creatingName !== null && (
        <NewPartyModal
          initialName={creatingName}
          role={role}
          label={label}
          onCreated={(p) => { setAdded((a) => [...a, p]); onChange(p.id, p); setQuery(p.name); setCreatingName(null); setOpen(false); setSearching(false); }}
          // Hand focus back to the field, otherwise the sync effect sees an unfocused
          // combobox with no pick and clears the name that was just typed. Re-arm
          // `searching` after onFocus resets it, so the filter and the button survive too.
          onClose={() => { setCreatingName(null); inputRef.current?.focus(); setSearching(true); }}
        />
      )}
    </div>
  );
}
