import type { ReactNode } from 'react';

type Variant = 'accent' | 'debit' | 'gold' | 'blue' | 'ink';

const VARIANT_CLASS: Record<Variant, string> = {
  accent: '',
  debit: 's-debit',
  gold: 's-gold',
  blue: 's-blue',
  ink: 's-ink',
};

export function StatCard({ label, value, variant = 'accent' }: { label: ReactNode; value: ReactNode; variant?: Variant }) {
  return (
    <div className={`stat ${VARIANT_CLASS[variant]}`}>
      <div className="lbl">{label}</div>
      <div className="val num">{value}</div>
    </div>
  );
}

export function StatsGrid({ children, columns }: { children: ReactNode; columns?: number }) {
  const colClass = columns === 3 ? 'stats-3' : '';
  return <div className={`grid stats ${colClass}`}>{children}</div>;
}
