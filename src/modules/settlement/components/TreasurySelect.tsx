'use client';

import { useTreasuryNames } from '../../treasury/hooks';

/** قيمة خيار «تسوية» — حركة على حساب الاسم من غير خزنة. */
export const SETTLE = '__settle__';

/**
 * خزائن الجنيه — رأس مال التصفية الثابتة وسحبها بالجنيه فقط. `allowSettle` يضيف
 * خيار «تسوية» (حركة رأس مال على حسابه من غير ما فلوس تدخل أو تخرج).
 */
export function TreasurySelect({ value, onChange, allowSettle = false }: {
  value: string; onChange: (id: string) => void; allowSettle?: boolean;
}) {
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
      <option value="">{allowSettle ? 'اختر الخزنة أو التسوية' : 'اختر الخزنة'}</option>
      {allowSettle && <option value={SETTLE}>تسوية (بدون خزنة)</option>}
      {options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
}
