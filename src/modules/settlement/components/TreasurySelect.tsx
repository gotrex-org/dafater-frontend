'use client';

import { useTreasuryNames } from '../../treasury/hooks';

/** خزائن الجنيه — رأس مال التصفية الثابتة وسحبها بالجنيه فقط. */
export function TreasurySelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data } = useTreasuryNames();
  const options = (data ?? []).filter((t) => t.currency !== 'USD');
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', padding: '11px 12px', border: '1.5px solid var(--line)',
        borderRadius: 10, background: 'var(--surface)', fontSize: 14,
      }}
    >
      <option value="">اختر الخزنة</option>
      {options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
}
