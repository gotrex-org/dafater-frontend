'use client';

import { useState } from 'react';
import { fmtDate } from '@/lib/format';
import { useTableState } from '@/lib/useTableState';
import { useAuth } from '@/lib/auth';
import { useWindows } from '@/lib/windows';
import { PageTitle, DataTable, SearchInput, type Column } from '@/components/common';
import { useManifests } from '../hooks';
import type { Manifest } from '../dtos';
import { ManifestEditor } from './ManifestEditor';
import { ManifestPrint } from './ManifestPrint';

export function ManifestsView() {
  const { can } = useAuth();
  const { open } = useWindows();
  const [viewId, setViewId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { page, setPage, pageSize, setPageSize } = useTableState();
  const { data, isLoading } = useManifests({ page, pageSize, search: search || undefined, from: from || undefined, to: to || undefined });

  const openNew = () => open({
    title: 'كشف عربية جديد',
    render: (close) => <ManifestEditor onClose={close} onCreated={(m) => { close(); setViewId(m.id); }} />,
  });

  if (viewId) return <ManifestPrint id={viewId} onClose={() => setViewId(null)} />;

  const manifestStatus = (m: Manifest): 'arrived' | 'pending' | 'none' => {
    const trips = m.driverTrips ?? [];
    if (!trips.length) return 'none';
    return trips.some((t) => t.arrivalDate) ? 'arrived' : 'pending';
  };

  const STATUS_STYLE: Record<string, React.CSSProperties> = {
    arrived: { background: 'rgba(178,58,46,0.10)', borderRight: '3px solid var(--debit)' },
    pending: { background: 'rgba(15,110,92,0.10)', borderRight: '3px solid var(--credit)' },
    none: {},
  };

  const columns: Column<Manifest>[] = [
    { header: 'رقم', cell: (m) => m.no },
    { header: 'العميل', cell: (m) => m.clientName },
    { header: 'السائق', cell: (m) => m.driverName || '—' },
    { header: 'العربية', cell: (m) => m.vehicleNo || '—', className: 'muted' },
    { header: 'المقطورة', cell: (m) => m.trailerNo || '—', className: 'muted' },
    { header: 'التاريخ', cell: (m) => fmtDate(m.date), className: 'muted' },
    {
      header: 'الحالة',
      cell: (m) => {
        const s = manifestStatus(m);
        if (s === 'arrived') return <span className="deb" style={{ fontWeight: 700, fontSize: 12 }}>وصلت ✓</span>;
        if (s === 'pending') return <span className="cre" style={{ fontWeight: 700, fontSize: 12 }}>في الطريق</span>;
        return <span className="muted" style={{ fontSize: 12 }}>—</span>;
      },
    },
  ];

  return (
    <>
      <PageTitle title="كشوفات العربيات" subtitle="كشف استلام/تحميل لكل عربية — اضغط على أي كشف لعرضه وطباعته" />
      <div className="toolbar">
        {can('manifests.create') && <button className="btn btn-primary btn-sm sp" onClick={openNew}>+ كشف جديد</button>}
      </div>
      <div className="toolbar" style={{ marginTop: 6, flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="بحث بالعميل أو السائق أو العربية…" />
        <span className="muted" style={{ fontSize: 12 }}>من</span>
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        <span className="muted" style={{ fontSize: 12 }}>إلى</span>
        <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        {(search || from || to) && <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFrom(''); setTo(''); setPage(1); }}>× مسح</button>}
      </div>
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(m) => m.id}
        onRowClick={(m) => setViewId(m.id)}
        rowStyle={(m) => STATUS_STYLE[manifestStatus(m)]}
        loading={isLoading}
        emptyText="لا توجد كشوفات"
        meta={data?.meta}
        onPage={setPage}
        pageSize={pageSize}
        onPageSize={setPageSize}
      />
    </>
  );
}
