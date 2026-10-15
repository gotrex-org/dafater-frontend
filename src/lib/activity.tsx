// نشاط الحركة المالية — تجارة / شحن / مشترك (المرتبات مقسّمة بنسبة من الإعدادات).
export type Activity = 'TRADE' | 'SHIPPING' | 'SHARED';

export const ACTIVITY_LABEL: Record<Activity, string> = {
  TRADE: 'تجارة',
  SHIPPING: 'شحن',
  SHARED: 'مشترك',
};

const COLOR: Record<Activity, string> = {
  TRADE: 'var(--accent, #2563eb)',
  SHIPPING: 'var(--warn, #b45309)',
  SHARED: 'var(--ink-soft, #64748b)',
};

export function ActivityBadge({ activity, pct }: { activity?: Activity | null; pct?: number | null }) {
  if (!activity) return null;
  const label = activity === 'SHARED' && pct != null ? `مشترك (${pct}% شحن)` : ACTIVITY_LABEL[activity];
  return (
    <span
      style={{
        display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
        border: `1px solid ${COLOR[activity]}`, color: COLOR[activity], whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
