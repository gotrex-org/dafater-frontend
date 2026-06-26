'use client';

import { useState } from 'react';
import { fmtDate } from '@/lib/format';
import { useTableState } from '@/lib/useTableState';
import { useAuth } from '@/lib/auth';
import { PageTitle, DataTable, SegmentedControl, Combobox, SearchInput, type Column } from '@/components/common';
import { useAllParties } from '../../parties/hooks';
import { useRequests, useMarkRequestDone } from '../hooks';
import { useOrders, useMarkOrderDone } from '../../orders/hooks';
import type { ClientRequest } from '../dtos';
import type { Order } from '../../orders/dtos';
import { RequestEditor } from './RequestEditor';
import { RequestDetail } from './RequestDetail';
import { OrderDetail } from '../../orders/components/OrderDetail';

const remainingOf = (it: { qty: number; received?: number }) => Math.max(0, it.qty - (it.received ?? 0));

const SOURCE_OPTS = [
  { value: 'clients', label: 'طلبيات العملاء' },
  { value: 'portal', label: 'طلبيات البورتال' },
];

export function RequestsView() {
  const { can } = useAuth();
  const { data: clients } = useAllParties('CLIENT');
  const [source, setSource] = useState<'clients' | 'portal'>('clients');
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const [clientId, setClientId] = useState('');
  const [search, setSearch] = useState('');
  const [requestDetail, setRequestDetail] = useState<ClientRequest | null>(null);
  const [orderDetail, setOrderDetail] = useState<Order | null>(null);
  const { page, setPage, pageSize, setPageSize } = useTableState();

  const { data: reqData, isLoading: reqLoading } = useRequests({
    page, pageSize,
    done: tab === 'done',
    clientId: clientId || undefined,
  });

  const { data: ordData, isLoading: ordLoading } = useOrders({
    page, pageSize,
    done: tab === 'done',
    search: search || undefined,
  } as any);

  const markReqDone = useMarkRequestDone();
  const markOrdDone = useMarkOrderDone();

  if (requestDetail) return <RequestDetail request={requestDetail} onClose={() => setRequestDetail(null)} />;
  if (orderDetail) return <OrderDetail order={orderDetail} onClose={() => setOrderDetail(null)} />;
  if (mode === 'create') return <RequestEditor onClose={() => setMode('list')} />;

  const reqColumns: Column<ClientRequest>[] = [
    { header: 'التاريخ', cell: (r) => fmtDate(r.date) },
    { header: 'العميل', cell: (r) => r.client?.name },
    { header: 'عدد الأصناف', cell: (r) => r.items?.length ?? 0, className: 'num' },
    {
      header: 'المتبقّي',
      cell: (r) => r.items?.map((i) => `${i.name} (${remainingOf(i)})`).join('، '),
      className: 'muted',
    },
    ...(tab === 'active'
      ? [{
          header: '',
          cell: (r: ClientRequest) => (
            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); markReqDone.mutate(r.id); }}>✓ تم بالكامل</button>
          ),
        }]
      : []),
  ];

  const ordColumns: Column<Order>[] = [
    { header: 'التاريخ', cell: (o) => fmtDate(o.date) },
    { header: 'العميل', cell: (o) => o.party?.name ?? o.name },
    { header: 'عدد الأصناف', cell: (o) => o.items?.length ?? 0, className: 'num' },
    {
      header: 'المتبقّي',
      cell: (o) => o.items?.map((i) => `${i.name} (${remainingOf(i)})`).join('، '),
      className: 'muted',
    },
    ...(tab === 'active'
      ? [{
          header: '',
          cell: (o: Order) => (
            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); markOrdDone.mutate(o.id); }} disabled={markOrdDone.isPending}>
              ✓ تم بالكامل
            </button>
          ),
        }]
      : []),
  ];

  return (
    <>
      <PageTitle title="الطلبيات" subtitle="طلبية لكل عميل — اضغط على الطلبية لتسجيل الوارد، وتختفي عند اكتمالها" />
      <div className="toolbar">
        <SegmentedControl value={source} onChange={(v) => { setSource(v as typeof source); setPage(1); }} options={SOURCE_OPTS} />
        <SegmentedControl
          value={tab}
          onChange={(v) => { setTab(v as typeof tab); setPage(1); }}
          options={[{ value: 'active', label: 'الحالية' }, { value: 'done', label: 'المنتهية' }]}
        />
        {source === 'clients'
          ? <div style={{ minWidth: 200 }}><Combobox options={clients?.data ?? []} value={clientId} onChange={(id) => { setClientId(id); setPage(1); }} placeholder="كل العملاء" /></div>
          : <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="بحث بالاسم أو الطلبية…" />
        }
        {source === 'clients' && can('requests.create') && (
          <button className="btn btn-primary btn-sm sp" onClick={() => setMode('create')}>+ طلبية جديدة</button>
        )}
      </div>

      {source === 'clients' ? (
        <DataTable
          columns={reqColumns}
          rows={reqData?.data ?? []}
          rowKey={(r) => r.id}
          onRowClick={setRequestDetail}
          loading={reqLoading}
          emptyText="لا توجد طلبات"
          meta={reqData?.meta}
          onPage={setPage}
          pageSize={pageSize}
          onPageSize={setPageSize}
        />
      ) : (
        <DataTable
          columns={ordColumns}
          rows={ordData?.data ?? []}
          rowKey={(o) => o.id}
          onRowClick={setOrderDetail}
          loading={ordLoading}
          emptyText="لا توجد طلبيات"
          meta={ordData?.meta}
          onPage={setPage}
          pageSize={pageSize}
          onPageSize={setPageSize}
        />
      )}
    </>
  );
}
