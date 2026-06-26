'use client';

import { useState } from 'react';
import { fmtDate } from '@/lib/format';
import { useTableState } from '@/lib/useTableState';
import { useAuth } from '@/lib/auth';
import { PageTitle, DataTable, SearchInput, type Column } from '@/components/common';
import { useWarnOnLeave } from '@/lib/unsaved';
import { useManifests } from '../hooks';
import type { Manifest } from '../dtos';
import { ManifestEditor } from './ManifestEditor';
import { ManifestPrint } from './ManifestPrint';

export function ManifestsView() {
  const { can } = useAuth();
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [viewId, setViewId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { page, setPage, pageSize, setPageSize } = useTableState();
  const { data, isLoading } = useManifests({ page, pageSize, search: search || undefined, from: from || undefined, to: to || undefined });

  useWarnOnLeave(mode === 'create');

  if (viewId) return <ManifestPrint id={viewId} onClose={() => setViewId(null)} />;
  if (mode === 'create')
    return (
      <ManifestEditor
        onClose={() => setMode('list')}
        onCreated={(m) => { setMode('list'); setViewId(m.id); }}
      />
    );

  const columns: Column<Manifest>[] = [
    { header: 'رقم', cell: (m) => m.no },
    { header: 'العميل', cell: (m) => m.clientName },
    { header: 'السائق', cell: (m) => m.driverName || '—' },
    { header: 'العربية', cell: (m) => m.vehicleNo || '—', className: 'muted' },
    { header: 'المقطورة', cell: (m) => m.trailerNo || '—', className: 'muted' },
    { header: 'التاريخ', cell: (m) => fmtDate(m.date), className: 'muted' },
  ];

  return (
    <>
      <PageTitle title="كشوفات العربيات" subtitle="كشف استلام/تحميل لكل عربية — اضغط على أي كشف لعرضه وطباعته" />
      <div className="toolbar">
        {can('manifests.create') && <button className="btn btn-primary btn-sm sp" onClick={() => setMode('create')}>+ كشف جديد</button>}
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
