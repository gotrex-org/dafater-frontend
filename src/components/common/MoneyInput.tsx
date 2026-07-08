'use client';

import type { CSSProperties, KeyboardEvent } from 'react';

/** format a raw numeric string with thousand separators, keeping a typed decimal */
export function formatMoney(raw: string | number | undefined): string {
  if (raw === '' || raw === undefined || raw === null) return '';
  const [int, dec] = String(raw).replace(/[^\d.]/g, '').split('.');
  const intF = int ? Number(int).toLocaleString('en-US') : '0';
  return dec !== undefined ? `${intF}.${dec}` : intF;
}

/**
 * Numeric input that shows thousand separators while typing (1,000,000) but
 * reports the raw digits string to the parent (so Number(value) still works).
 */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  style,
  onKeyDown,
  autoFocus,
}: {
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string;
  style?: CSSProperties;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={formatMoney(value)}
      placeholder={placeholder}
      style={style}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
      onKeyDown={onKeyDown}
    />
  );
}
