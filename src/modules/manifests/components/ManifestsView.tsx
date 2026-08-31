'use client';

import { useState } from 'react';
import { fmtDate } from '@/lib/format';
import { useTableState } from '@/lib/useTableState';
import { useAuth } from '@/lib/auth';
import { useWindows } from '@/lib/windows';
import { PageTitle, DataTable, SearchInput, type Column } from '@/components/common';
import { useManifests, useUpdateManifest } from '../hooks';
import type { Manifest } from '../dtos';
import { ManifestEditor } from './ManifestEditor';
import { ManifestPrint } from './ManifestPrint';

/**
 * تعديل «مسمّى العربية» من القايمة على طول — العمود اتضاف بعد ما الكشوفات القديمة
 * اتسجّلت، فكلها من غير مسمّى. فتح المحرر الكامل لكل واحدة تقيل (وبيعيد كتابة كل
 * أصنافها)، فده PATCH بحقل واحد بس ما بيلمسش الأصناف.
 */
function VehicleLabelCell({ m, canEdit }: { m: Manifest; canEdit: boolean }) {
  const update = useUpdateManifest();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(m.vehicleLabel ?? '');

  const save = () => {
    const next = value.trim();
    if (next === (m.vehicleLabel ?? '')) return setEditing(false);
    update.mutate(
      { id: m.id, dto: { vehicleLabel: next } },
      { onSuccess: () => setEditing(false) },
    );
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') { setValue(m.vehicleLabel ?? ''); setEditing(false); }
          }}
          placeholder="عربية الزيتون"
          style={{ width: 130, padding: '4px 7px', border: '1.5px solid var(--accent)', borderRadius: 7, fontSize: 12 }}
        />
        <button className="btn btn-primary btn-sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={save} disabled={update.isPending}>
          {update.isPending ? '…' : '✓'}
        </button>
      </div>
    );
  }

  return (
    <span
      onClick={canEdit ? (e) => { e.stopPropagation(); setEditing(true); } : undefined}
      title={canEdit ? 'اضغط لتعديل مسمّى العربية' : undefined}
      style={canEdit ? { cursor: 'text', borderBottom: '1px dashed var(--line)' } : undefined}
    >
      {m.vehicleLabel
        ? <><b>{m.vehicleLabel}</b>{m.vehicleNo ? ` — ${m.vehicleNo}` : ''}</>
        : <>{m.vehicleNo || '—'}{canEdit && <span className="muted" style={{ fontSize: 11 }}> · + مسمّى</span>}</>}
    </span>
  );
}

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

  // خلفية السطر بس — الشريط الجانبي اتشال لأن شبكة حدود الجدول (mf-lines/mf-list)
  // بتغطّي عليه؛ اللون بقى باين من خلفية السطر + بادچ الحالة الملوّن.
  const STATUS_STYLE: Record<string, React.CSSProperties> = {
    arrived: { background: 'rgba(178,58,46,0.12)' },
    pending: { background: 'rgba(15,110,92,0.12)' },
    none: {},
  };

  const columns: Column<Manifest>[] = [
    { header: 'رقم', cell: (m) => m.no },
    { header: 'العميل', cell: (m) => m.clientName },
    { header: 'السائق', cell: (m) => m.driverName || '—' },
    { header: 'العربية', cell: (m) => <VehicleLabelCell m={m} canEdit={can('manifests.edit')} /> },
    { header: 'المقطورة', cell: (m) => m.trailerNo || '—', className: 'muted' },
    { header: 'التاريخ', cell: (m) => fmtDate(m.date), className: 'muted' },
    // الربط بالفاتورة — بيبيّن الكشوفات اللي لسه مستقلة وماتظهرش كتاب في أي فاتورة
    {
      header: 'الفاتورة',
      cell: (m) => m.invoice
        ? <span className="pill">فاتورة {m.invoice.no}</span>
        : <span className="muted">مستقل</span>,
    },
    {
      header: 'الحالة',
      cell: (m) => {
        // نفس ألوان تابات العربيات في الفاتورة (mt-status) عشان الحالة تتقرا بنفس
        // اللون في كل مكان — بادچ ملوّن بدل نص عادي.
        const s = manifestStatus(m);
        if (s === 'arrived') return <span className="pill mt-status st-arrived">وصلت ✓</span>;
        if (s === 'pending') return <span className="pill mt-status st-pending">في الطريق</span>;
        return <span className="pill mt-status st-none">—</span>;
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
      {/* mf-list = شبكة حدود كاملة زي الشيت (DataTable مابيمرّرش كلاس) */}
      <div className="mf-list">
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
      </div>
    </>
  );
}
