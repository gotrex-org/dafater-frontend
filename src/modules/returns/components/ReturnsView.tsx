'use client';

import { useState } from 'react';
import { EGP, fmtDate } from '@/lib/format';
import { useTableState } from '@/lib/useTableState';
import { useAuth } from '@/lib/auth';
import { useWindows } from '@/lib/windows';
import { confirmCascadeDelete } from '@/lib/cascadeDelete';
import { PageTitle, DataTable, SearchInput, type Column } from '@/components/common';
import { useReturns, useDeleteReturn } from '../hooks';
import type { ReturnDoc } from '../dtos';
import { ReturnEditor } from './ReturnEditor';

const total = (r: ReturnDoc) => r.items.reduce((s, it) => s + it.qty * it.price, 0);

export function ReturnsView() {
  const { can } = useAuth();
  const { open } = useWindows();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ReturnDoc | null>(null);
  const { page, setPage, pageSize, setPageSize } = useTableState();
  const { data, isLoading } = useReturns({ page, pageSize, search: search || undefined });

  const openNew = () => open({ title: 'مرتجع جديد', render: (close) => <ReturnEditor onClose={close} /> });

  if (selected) return <ReturnDetail ret={selected} onBack={() => setSelected(null)} />;

  const columns: Column<ReturnDoc>[] = [
    { header: 'رقم', cell: (r) => r.no },
    { header: 'التاريخ', cell: (r) => fmtDate(r.date) },
    { header: 'النوع', cell: (r) => <span className={r.kind === 'SALE' ? 'cre' : 'deb'}>{r.kind === 'SALE' ? 'مرتجع بيع' : 'مرتجع شراء'}</span> },
    { header: 'الطرف', cell: (r) => r.party?.name },
    { header: 'من فاتورة', cell: (r) => (r.invoice ? `#${r.invoice.no}` : '—'), className: 'muted' },
    { header: 'الإجمالي', cell: (r) => EGP(total(r)), className: 'num' },
    { header: 'مسترد نقدًا', cell: (r) => (r.refund > 0 ? EGP(r.refund) : '—'), className: 'num muted' },
  ];

  return (
    <>
      <div className="toolbar">
        {can('invoices') && <button className="btn btn-primary btn-sm sp" onClick={openNew}>+ مرتجع جديد</button>}
      </div>
      <div className="toolbar" style={{ marginTop: 6 }}>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="بحث برقم المرتجع أو اسم الطرف…" />
      </div>
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(r) => r.id}
        onRowClick={setSelected}
        loading={isLoading}
        emptyText="لا توجد مرتجعات"
        meta={data?.meta}
        onPage={setPage}
        pageSize={pageSize}
        onPageSize={setPageSize}
      />
    </>
  );
}

function ReturnDetail({ ret, onBack }: { ret: ReturnDoc; onBack: () => void }) {
  const { can } = useAuth();
  const deleteReturn = useDeleteReturn();
  const t = total(ret);
  const isSale = ret.kind === 'SALE';

  const handleDelete = () => {
    if (!window.confirm(`حذف المرتجع رقم ${ret.no}؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    confirmCascadeDelete(deleteReturn, ret.id, { onSuccess: onBack });
  };

  return (
    <>
      <div className="toolbar no-print">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع للمرتجعات</button>
        {can('invoices.delete') && <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleteReturn.isPending}>حذف</button>}
        <button className="btn btn-primary btn-sm sp" onClick={() => window.print()}>🖨 طباعة</button>
      </div>
      <div className="card print-sheet">
        <div className="mf-logo">أبو شامة</div>
        <div className="mf-head">
          <h2>{isSale ? 'مرتجع بيع' : 'مرتجع شراء'} — {ret.party?.name ?? '—'}</h2>
          <div className="mf-meta">
            <span>رقم <b>{ret.no}</b></span>
            <span>التاريخ: <b>{fmtDate(ret.date)}</b></span>
            {ret.invoice && <span>من فاتورة: <b>#{ret.invoice.no}</b></span>}
          </div>
        </div>
        <div className="mf-grid">
          {ret.warehouse?.name && <div className="mf-info"><span className="mf-info-l">المخزن</span><span className="mf-info-v">{ret.warehouse.name}</span></div>}
          {ret.refund > 0 && <div className="mf-info"><span className="mf-info-l">مسترد نقدًا</span><span className="mf-info-v">{EGP(ret.refund)}{ret.treasury?.name ? ` — ${ret.treasury.name}` : ''}</span></div>}
          {ret.note && <div className="mf-info"><span className="mf-info-l">البيان</span><span className="mf-info-v">{ret.note}</span></div>}
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th style={{ width: 90 }}>الكمية</th><th>الصنف</th><th style={{ width: 110 }}>السعر</th><th style={{ width: 120 }}>الإجمالي</th></tr></thead>
            <tbody>
              {ret.items.map((it, i) => (
                <tr key={it.id ?? i}>
                  <td className="num">{it.qty}</td>
                  <td>{it.product?.name ?? '—'}</td>
                  <td className="num">{EGP(it.price)}</td>
                  <td className="num">{EGP(it.qty * it.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="page-title num" style={{ marginTop: 12, textAlign: 'left' }}>إجمالي المرتجع: {EGP(t)}</div>
        <div className="mf-grow" />
      </div>
    </>
  );
}
