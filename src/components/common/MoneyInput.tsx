'use client';

import type { CSSProperties, KeyboardEvent } from 'react';

/** يبقّي الأرقام ونقطة عشرية واحدة فقط (أول نقطة) — يتجاهل أي نقاط زيادة (مثلاً "1..5") */
function sanitizeMoney(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  // احتفظ بالنقطة الأولى واحذف باقي النقاط
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}

/** format a raw numeric string with thousand separators, keeping a typed decimal */
export function formatMoney(raw: string | number | undefined): string {
  if (raw === '' || raw === undefined || raw === null) return '';
  const [int, dec] = sanitizeMoney(String(raw)).split('.');
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
      onChange={(e) => onChange(sanitizeMoney(e.target.value))}
      onKeyDown={onKeyDown}
    />
  );
}
