'use client';

import { useState } from 'react';
import { useTableState } from '@/lib/useTableState';
import { DataTable, type Column } from '@/components/common';
import { useTrash, useUndoAudit } from '../hooks';
import type { AuditLog } from '../dtos';

const ENTITY: Record<string, string> = {
  invoices: 'فاتورة',
  manifests: 'كشف عربية',
  parties: 'حساب / طرف',
  products: 'صنف',
  requests: 'طلب',
  deals: 'بيع خارجي',
  adjustments: 'تسوية مخزن',
  treasury: 'خزينة',
  transactions: 'حركة مالية',
  warehouses: 'مخزن',
  'expense-categories': 'بند مصروف',
  orders: 'طلبية عميل',
  'driver-trips': 'رحلة سائق',
  drivers: 'سائق',
  loans: 'سلفة',
  'dollar-agents': 'وكيل دولار',
};

const fmtWhen = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

export function TrashView() {
  const { page, setPage, pageSize, setPageSize } = useTableState();
  const { data, isLoading } = useTrash({ page, pageSize });
  const undoAudit = useUndoAudit();
  const [restoring, setRestoring] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const handleRestore = (log: AuditLog) => {
    if (!window.confirm(`استرجاع "${ENTITY[log.entity] ?? log.entity}${log.summary ? ` — ${log.summary}` : ''}"؟`)) return;
    setRestoring(log.id);
    setErr('');
    undoAudit.mutate(log.id, {
      onSuccess: () => setRestoring(null),
      onError: (e: any) => { setRestoring(null); setErr(e.message ?? 'حدث خطأ'); },
    });
  };

  const columns: Column<AuditLog>[] = [
    { header: 'النوع', cell: (r) => <b style={{ fontSize: 13 }}>{ENTITY[r.entity] ?? r.entity}</b> },
    { header: 'التفاصيل', cell: (r) => <span className="muted">{r.summary || '—'}</span> },
    { header: 'حذفه', cell: (r) => <span className="muted" style={{ fontSize: 12 }}>{r.userName}</span> },
    { header: 'وقت الحذف', cell: (r) => <span className="muted" style={{ fontSize: 12 }}>{fmtWhen(r.createdAt)}</span> },
    {
      header: '',
      cell: (r) => (
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--credit)', fontWeight: 700 }}
          onClick={(e) => { e.stopPropagation(); handleRestore(r); }}
          disabled={restoring === r.id || undoAudit.isPending}
        >
          {restoring === r.id ? '...' : '↩ استرجاع'}
        </button>
      ),
    },
  ];

  return (
    <div>
      {err && (
        <div className="err-text" style={{ margin: '0 0 12px', padding: '10px 14px', background: 'rgba(var(--debit-rgb, 178,58,46), 0.08)', borderRadius: 8 }}>
          {err}
        </div>
      )}
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(r) => r.id}
        loading={isLoading}
        emptyText="سلة المحذوفات فارغة"
        meta={data?.meta}
        onPage={setPage}
        pageSize={pageSize}
        onPageSize={setPageSize}
      />
    </div>
  );
}
