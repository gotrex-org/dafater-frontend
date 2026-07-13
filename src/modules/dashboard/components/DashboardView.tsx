'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EGP } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { PageTitle, StatsGrid, StatCard, Spinner } from '@/components/common';
import { useDashboard } from '../hooks';
import { useReportSummary, useTopProducts, useInactiveClients } from '../../reports/hooks';

// A statistics-style panel: a titled card holding stacked rows.
function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
        {action}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </div>
  );
}

function StatRow({ label, value, sub, tone, onClick }: { label: string; value: React.ReactNode; sub?: string; tone?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="stat"
      style={{ cursor: onClick ? 'pointer' : 'default', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
        {sub && <div className="muted" style={{ fontSize: 11 }}>{sub}</div>}
      </div>
      <div className="num" style={{ fontWeight: 800, fontSize: 16, color: tone, whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

const LinkBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={onClick}>{children}</button>
);

// ── Reports panel (only for users allowed to see reports) ──
function ReportsPanel({ go }: { go: () => void }) {
  const summary = useReportSummary({});
  const products = useTopProducts({});
  const inactive = useInactiveClients(45);
  const s = summary.data;
  const topProduct = products.data?.[0];
  return (
    <Panel title="التقارير" action={<LinkBtn onClick={go}>عرض الكل ←</LinkBtn>}>
      {summary.isLoading || !s ? <Spinner /> : (
        <>
          <StatRow label="المبيعات" value={`${EGP(s.sales)} ج.م`} tone="var(--gold)" onClick={go} />
          <StatRow label="المشتريات" value={`${EGP(s.purchases)} ج.م`} onClick={go} />
          <StatRow label="مجمل الربح التقديري" value={`${EGP(s.grossProfit)} ج.م`} tone={s.grossProfit >= 0 ? 'var(--credit)' : 'var(--debit)'} onClick={go} />
          {topProduct && <StatRow label="أكتر صنف مباع" value={topProduct.name} sub={`كمية ${topProduct.qty}`} onClick={go} />}
          <StatRow label="عملاء متوقفين (+45 يوم)" value={inactive.data?.length ?? '—'} tone="var(--debit)" onClick={go} />
        </>
      )}
    </Panel>
  );
}

export function DashboardView() {
  const { user, can } = useAuth();
  const router = useRouter();
  const go = (path: string, view: string) => (can(view) ? () => router.push(path) : () => {});

  const { data, isLoading, error } = useDashboard();
  if (error) return <div className="empty">خطأ: {(error as Error).message}</div>;
  if (isLoading || !data) return <Spinner />;

  const isPrimary = !!user?.isPrimary;

  // Per-browser customization: hide dashboard cards the user doesn't want to see.
  const HIDE_KEY = 'dashHidden';
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(HIDE_KEY) || '[]')); } catch { return new Set(); }
  });
  const [editing, setEditing] = useState(false);
  const toggleHide = (k: string) => setHidden((s) => {
    const n = new Set(s);
    n.has(k) ? n.delete(k) : n.add(k);
    try { localStorage.setItem(HIDE_KEY, JSON.stringify([...n])); } catch {}
    return n;
  });
  const wrap = (k: string, node: React.ReactNode) => {
    if (!editing && hidden.has(k)) return null;
    return (
      <div style={{ position: 'relative', opacity: editing && hidden.has(k) ? 0.45 : 1 }}>
        {editing && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ position: 'absolute', top: 6, insetInlineEnd: 6, zIndex: 3, background: '#fff' }}
            onClick={(e) => { e.stopPropagation(); toggleHide(k); }}
          >
            {hidden.has(k) ? '👁 إظهار' : '🙈 إخفاء'}
          </button>
        )}
        {node}
      </div>
    );
  };

  return (
    <>
      <PageTitle title="لوحة التحكم" />

      <div className="toolbar">
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing((v) => !v)}>{editing ? '✓ تم' : '⚙ تخصيص العرض'}</button>
        {editing && hidden.size > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setHidden(new Set()); try { localStorage.removeItem(HIDE_KEY); } catch {} }}>إظهار الكل</button>
        )}
      </div>

      <StatsGrid>
        {wrap('cash', (
          <div onClick={go('/treasury', 'treasury')} style={{ cursor: can('treasury') ? 'pointer' : 'default' }}>
            <StatCard variant="blue" label="النقدية (ج.م)" value={EGP(data.cashByCurrency.EGP || 0)} />
          </div>
        ))}
        {wrap('inventory', (
          <div onClick={go('/inventory', 'inventory')} style={{ cursor: can('inventory') ? 'pointer' : 'default' }}>
            <StatCard variant="gold" label="قيمة المخزون" value={EGP(data.inventoryValue)} />
          </div>
        ))}
        {user?.admin && wrap('receivable', <StatCard label="مستحق لنا (العملاء)" value={EGP(data.receivable)} />)}
        {user?.admin && wrap('payable', <StatCard variant="debit" label="مستحق علينا (الموردين)" value={EGP(data.payable)} />)}
      </StatsGrid>

      {/* Statistics-style panels side by side: الخزن · التقارير */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16, marginTop: 16, alignItems: 'start' }}>
        {wrap('treasuries', (
          <Panel title="الخزن" action={can('treasury') ? <LinkBtn onClick={() => router.push('/treasury')}>عرض ←</LinkBtn> : undefined}>
            {data.treasury.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>لا توجد خزائن</div> : data.treasury.map((t) => (
              <StatRow
                key={t.id}
                label={t.name}
                value={`${EGP(t.balance)} ${t.currency === 'USD' ? '$' : 'ج.م'}`}
                tone={(t.balance ?? 0) >= 0 ? undefined : 'var(--debit)'}
                onClick={can('treasury') ? () => router.push('/treasury') : undefined}
              />
            ))}
          </Panel>
        ))}

        {isPrimary && wrap('reports', <ReportsPanel go={() => router.push('/today')} />)}
      </div>
    </>
  );
}
