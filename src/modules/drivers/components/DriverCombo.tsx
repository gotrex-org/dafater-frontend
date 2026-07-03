'use client';

import { useState } from 'react';
import { useDrivers } from '../hooks';
import type { Driver } from '../dtos';

export function DriverCombo({
  value,
  onChange,
  onSelect,
  placeholder = 'اكتب اسم السائق…',
}: {
  value: string;
  onChange: (name: string) => void;
  onSelect: (driver: Driver) => void;
  placeholder?: string;
}) {
  const { data } = useDrivers();
  const drivers = data?.data ?? [];
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);

  const q = value.trim().toLowerCase();
  const matches = q ? drivers.filter((d) => d.name.toLowerCase().includes(q)).slice(0, 8) : [];

  const pick = (d: Driver) => { onChange(d.name); onSelect(d); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !matches.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && matches[hi]) { e.preventDefault(); e.stopPropagation(); pick(matches[hi]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="combo">
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {open && matches.length > 0 && (
        <ul className="combo-list">
          {matches.map((d, i) => (
            <li
              key={d.id}
              className={i === hi ? 'hi' : ''}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(d); }}
            >
              <span>{d.name}</span>
              {(d.vehicleNo || d.phone) && (
                <span className="muted" style={{ fontSize: 11, marginInlineStart: 8 }}>
                  {[d.vehicleNo, d.phone].filter(Boolean).join(' · ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
