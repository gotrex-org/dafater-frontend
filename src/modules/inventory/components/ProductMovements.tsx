'use client';

import { useState } from 'react';
import { EGP, QTY, fmtDate } from '@/lib/format';
import { PageTitle, DataTable, Spinner, SegmentedControl, Combobox, StatsGrid, StatCard, type Column } from '@/components/common';
import { useProductMovements } from '../../products/hooks';
import type { ProductMovement } from '../../products/dtos';

export function ProductMovements({ productId, name, onBack }: { productId: string; name: string; onBack: () => void }) {
  const { data = [], isLoading } = useProductMovements(productId);
  const [tab, setTab] = useState<'all' | 'in' | 'out'>('all');
  const [q, setQ] = useState('');

  const bought = data.filter((r) => r.kind === 'PURCHASE').reduce((s, r) => s + r.qty, 0);
  const sold = data.filter((r) => r.kind === 'SALE').reduce((s, r) => s + r.qty, 0);

  const persons = Array.from(new Set(data.map((r) => r.party).filter(Boolean))).map((n) => ({ id: n as string, name: n as string }));
  const filtered = data.filter((r) =>
    (tab === 'all' || (tab === 'in' && r.kind === 'PURCHASE') || (tab === 'out' && r.kind === 'SALE')) &&
    (!q.trim() || (r.party ?? '').includes(q.trim())),
  );

  const cols: Column<ProductMovement>[] = [
    { header: 'التاريخ', cell: (r) => fmtDate(r.date), className: 'muted' },
    { header: 'الحركة', cell: (r) => (r.kind === 'PURCHASE' ? <span className="cre">دخول (شراء)</span> : <span className="deb">خروج (بيع)</span>) },
    { header: 'المورد / العميل', cell: (r) => <b>{r.party ?? '—'}</b> },
    { header: 'المخزن', cell: (r) => r.warehouse ?? '—', className: 'muted' },
    { header: 'الكمية', cell: (r) => QTY(r.qty), className: 'num' },
    { header: 'السعر', cell: (r) => EGP(r.price), className: 'num' },
  ];

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع للمخزن</button>
      <PageTitle title={`تقرير الصنف: ${name}`} subtitle="كل الكميات اللي اتشريت واتباعت، ومن مين وله مين" />

      <StatsGrid columns={2}>
        <StatCard variant="blue" label="إجمالي المشترى (دخول)" value={QTY(bought)} />
        <StatCard variant="gold" label="إجمالي المُباع (خروج)" value={QTY(sold)} />
      </StatsGrid>

      <div className="toolbar">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[{ value: 'all', label: 'الكل' }, { value: 'in', label: 'جه من (شراء)' }, { value: 'out', label: 'طلع لـ (بيع)' }]}
        />
        <div style={{ minWidth: 200 }}><Combobox options={persons} value={q} onChange={setQ} placeholder="اكتب واختر شخص…" /></div>
      </div>

      {isLoading ? <Spinner /> : <DataTable columns={cols} rows={filtered} rowKey={(r) => r.id} emptyText="لا توجد حركات لهذا الصنف" />}
    </>
  );
}
