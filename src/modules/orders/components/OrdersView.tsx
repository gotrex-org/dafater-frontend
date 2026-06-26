'use client';

import { useState } from 'react';
import { fmtDate } from '@/lib/format';
import { useTableState } from '@/lib/useTableState';
import { useAuth } from '@/lib/auth';
import { PageTitle, DataTable, SegmentedControl, SearchInput, type Column } from '@/components/common';
import { useOrders, useMarkOrderDone } from '../hooks';
import type { Order } from '../dtos';
import { OrderDetail } from './OrderDetail';

const remainingOf = (it: { qty: number; received?: number }) => Math.max(0, it.qty - (it.received ?? 0));

export function OrdersView({ hideTitle }: { hideTitle?: boolean } = {}) {
  const { can } = useAuth();
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const [detail, setDetail] = useState<Order | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { page, setPage, pageSize, setPageSize } = useTableState();
  const { data, isLoading } = useOrders({ page, pageSize, done: tab === 'done', search: search || undefined, from: from || undefined, to: to || undefined } as any);
  const markDone = useMarkOrderDone();

  if (detail) return <OrderDetail order={detail} onClose={() => setDetail(null)} />;

  const columns: Column<Order>[] = [
    { header: 'التاريخ', cell: (o) => fmtDate(o.date) },
    { header: 'العميل', cell: (o) => o.party?.name ?? o.name },
    {
      header: 'المتبقّي',
      cell: (o) => o.items?.map((i) => `${i.name} (${remainingOf(i)})`).join('، '),
      className: 'muted',
    },
    ...(tab === 'active'
      ? [{
          header: '',
          cell: (o: Order) => (
            <button
              className="btn btn-ghost btn-sm"
              onClick={(e) => { e.stopPropagation(); markDone.mutate(o.id); }}
              disabled={markDone.isPending}
            >
              ✓ تم بالكامل
            </button>
          ),
        }]
      : []),
  ];

  return (
    <>
      {!hideTitle && <PageTitle title="طلبيات البورتال" subtitle="طلبيات العملاء من البوابة — اضغط على الطلبية لتسجيل الوارد" />}
      <div className="toolbar">
        <SegmentedControl
          value={tab}
          onChange={(v) => { setTab(v); setPage(1); }}
          options={[{ value: 'active', label: 'الحالية' }, { value: 'done', label: 'المنتهية' }]}
        />
      </div>
      <div className="toolbar" style={{ marginTop: 6, flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="بحث بالعميل أو الطلبية…" />
        <span className="muted" style={{ fontSize: 12 }}>من</span>
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        <span className="muted" style={{ fontSize: 12 }}>إلى</span>
        <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        {(search || from || to) && <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFrom(''); setTo(''); setPage(1); }}>× مسح</button>}
      </div>
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(o) => o.id}
        onRowClick={setDetail}
        loading={isLoading}
        emptyText="لا توجد طلبيات"
        meta={data?.meta}
        onPage={setPage}
        pageSize={pageSize}
        onPageSize={setPageSize}
      />
    </>
  );
}
