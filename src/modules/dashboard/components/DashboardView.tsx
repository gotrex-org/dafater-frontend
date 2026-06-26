'use client';

import { useRouter } from 'next/navigation';
import { EGP } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { PageTitle, DataTable, StatsGrid, StatCard, Spinner, CollapsibleSection, type Column } from '@/components/common';
import { useDashboard } from '../hooks';
import type { TreasuryAccount } from '../../treasury/dtos';

type WhRow = { id: string; name: string; value: number };
type TopRow = { id: string; name: string; role: string; balance: number };

export function DashboardView() {
  const { user, can } = useAuth();
  const router = useRouter();
  // navigate to a page only if the user is allowed to open it
  const go = (path: string, view: string) => (can(view) ? () => router.push(path) : undefined);

  const { data, isLoading, error } = useDashboard();

  if (error) return <div className="empty">خطأ: {(error as Error).message}</div>;
  if (isLoading || !data) return <Spinner />;

  const treasuryCols: Column<TreasuryAccount>[] = [
    { header: 'الحساب', cell: (t) => t.name },
    { header: 'العملة', cell: (t) => t.currency },
    { header: 'الرصيد', cell: (t) => EGP(t.balance), className: 'num' },
  ];
  const whCols: Column<WhRow>[] = [
    { header: 'المخزن', cell: (w) => w.name },
    { header: 'القيمة التقديرية', cell: (w) => EGP(w.value), className: 'num' },
  ];
  const topCols: Column<TopRow>[] = [
    { header: 'الاسم', cell: (p) => p.name },
    { header: 'النوع', cell: (p) => (p.role === 'CLIENT' ? 'عميل' : 'مورد') },
    { header: 'الرصيد', cell: (p) => <span className={p.balance >= 0 ? 'deb' : 'cre'}>{EGP(p.balance)}</span>, className: 'num' },
  ];

  return (
    <>
      <PageTitle title="لوحة التحكم" />

      <StatsGrid>
        <div onClick={go('/treasury', 'treasury')} style={{ cursor: can('treasury') ? 'pointer' : 'default' }}>
          <StatCard variant="blue" label="النقدية (ج.م)" value={EGP(data.cashByCurrency.EGP || 0)} />
        </div>
        <div onClick={go('/inventory', 'inventory')} style={{ cursor: can('inventory') ? 'pointer' : 'default' }}>
          <StatCard variant="gold" label="قيمة المخزون" value={EGP(data.inventoryValue)} />
        </div>
        {user?.admin && <StatCard label="مستحق لنا (العملاء)" value={EGP(data.receivable)} />}
        {user?.admin && <StatCard variant="debit" label="مستحق علينا (الموردين)" value={EGP(data.payable)} />}
      </StatsGrid>

      <CollapsibleSection title="الخزينة">
        <DataTable columns={treasuryCols} rows={data.treasury} rowKey={(t) => t.id} onRowClick={go('/treasury', 'treasury')} />
      </CollapsibleSection>

      <CollapsibleSection title="رصيد البضاعة في المخازن">
        <DataTable columns={whCols} rows={data.warehouses} rowKey={(w) => w.id} onRowClick={go('/inventory', 'inventory')} />
      </CollapsibleSection>

      {user?.admin && (
        <CollapsibleSection title="أعلى الأرصدة" defaultOpen={false}>
          <DataTable columns={topCols} rows={data.topBalances} rowKey={(p) => p.id} onRowClick={go('/ledger', 'ledger')} />
        </CollapsibleSection>
      )}
    </>
  );
}
