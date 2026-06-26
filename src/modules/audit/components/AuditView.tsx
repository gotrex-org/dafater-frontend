'use client';

import { useState } from 'react';
import { useTableState } from '@/lib/useTableState';
import { PageTitle, DataTable, type Column } from '@/components/common';
import { useUsers } from '../../users/hooks';
import { useAudit } from '../hooks';
import type { AuditLog } from '../dtos';

const COLORS = ['#0f6e5c', '#b23a2e', '#2c5a86', '#b98a2e', '#7a3e9d', '#0b7285', '#a83232'];
const colorFor = (name: string) =>
  COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

const FIELD_LABELS: Record<string, string> = {
  date: 'التاريخ', paid: 'المدفوع', note: 'البيان / ملاحظة',
  name: 'الاسم', phone: 'التليفون',
  clientName: 'العميل', driverName: 'السائق',
  vehicleNo: 'رقم العربية', trailerNo: 'رقم المقطورة',
  agreedFreight: 'الناولون المتفق', unit: 'الوحدة', status: 'الحالة',
};

const ENTITY: Record<string, string> = {
  invoices: 'فاتورة', manifests: 'كشف عربية', parties: 'حساب/طرف', products: 'صنف', requests: 'طلب',
  deals: 'بيع خارجي', adjustments: 'تسوية مخزن', treasury: 'خزينة', transactions: 'حركة',
  warehouses: 'مخزن', 'expense-categories': 'بند مصروف', users: 'مستخدم', orders: 'طلبية عميل', config: 'إعدادات',
};
const ACTION: Record<string, string> = { CREATE: 'إضافة', UPDATE: 'تعديل', DELETE: 'حذف' };
const ACTION_CLASS: Record<string, string> = { CREATE: 'cre', UPDATE: '', DELETE: 'deb' };

const fmtWhen = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

function AuditDetail({ log, onBack }: { log: AuditLog; onBack: () => void }) {
  return (
    <>
      <div className="toolbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع للسجل</button>
      </div>
      <div className="card" style={{ padding: 20, maxWidth: 480 }}>
        <div className="page-title" style={{ marginBottom: 16 }}>
          <span className={ACTION_CLASS[log.action]}>{ACTION[log.action] ?? log.action}</span>
          {' '}
          {ENTITY[log.entity] ?? log.entity}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px 24px', alignItems: 'baseline' }}>
          <span className="muted" style={{ fontSize: 13 }}>التوقيت</span>
          <span>{fmtWhen(log.createdAt)}</span>

          <span className="muted" style={{ fontSize: 13 }}>المستخدم</span>
          <b style={{ color: colorFor(log.userName) }}>{log.userName}</b>

          <span className="muted" style={{ fontSize: 13 }}>الإجراء</span>
          <span className={ACTION_CLASS[log.action]}>{ACTION[log.action] ?? log.action}</span>

          <span className="muted" style={{ fontSize: 13 }}>القسم</span>
          <span>{ENTITY[log.entity] ?? log.entity}</span>

          {log.summary && (
            <>
              <span className="muted" style={{ fontSize: 13 }}>التفاصيل</span>
              <span>{log.summary}</span>
            </>
          )}
        </div>

        {log.action === 'UPDATE' && log.diff && Object.keys(log.diff).length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 10 }}>
              التعديلات ({Object.keys(log.diff).length})
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {Object.entries(log.diff).map(([field, entry]) => (
                <div key={field} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px', alignItems: 'center', fontSize: 13, background: 'var(--line-soft)', borderRadius: 8, padding: '8px 12px' }}>
                  <span className="muted" style={{ fontWeight: 700, gridColumn: '1 / -1', fontSize: 12 }}>
                    {FIELD_LABELS[field] ?? field}
                  </span>
                  <span style={{ color: 'var(--debit)', textDecoration: 'line-through', fontSize: 13 }}>
                    {entry.from != null ? String(entry.from) : '(فارغ)'}
                  </span>
                  <span style={{ color: 'var(--credit)', fontWeight: 700, fontSize: 13 }}>
                    ← {entry.to != null ? String(entry.to) : '(فارغ)'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function AuditView() {
  const { page, setPage, pageSize, setPageSize } = useTableState();
  const [user, setUser] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const { data: users } = useUsers();
  const { data, isLoading } = useAudit({ page, pageSize, user: user || undefined });

  if (selected) return <AuditDetail log={selected} onBack={() => setSelected(null)} />;

  const columns: Column<AuditLog>[] = [
    { header: 'متى', cell: (r) => fmtWhen(r.createdAt), className: 'muted' },
    { header: 'مين', cell: (r) => <b style={{ color: colorFor(r.userName) }}>{r.userName}</b> },
    { header: 'الإجراء', cell: (r) => <span className={ACTION_CLASS[r.action]}>{ACTION[r.action] ?? r.action}</span> },
    { header: 'النوع', cell: (r) => ENTITY[r.entity] ?? r.entity },
    {
      header: 'التفاصيل',
      cell: (r) => (
        <span>
          {r.summary || '—'}
          {r.action === 'UPDATE' && r.diff && Object.keys(r.diff).length > 0 && (
            <span className="pill" style={{ marginInlineStart: 6, background: 'var(--line-soft)', color: 'var(--ink-soft)', fontSize: 10 }}>
              {Object.keys(r.diff).length} حقل
            </span>
          )}
        </span>
      ),
      className: 'muted',
    },
  ];

  return (
    <>
      <PageTitle title="سجل النشاط" subtitle="كل التعديلات اللي بتحصل في النظام — مين عمل إيه وإمتى" />
      <div className="toolbar">
        <select value={user} onChange={(e) => { setUser(e.target.value); setPage(1); }} style={{ padding: '10px 12px', border: '1.5px solid var(--line)', borderRadius: 10 }}>
          <option value="">كل المستخدمين</option>
          {users?.data.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
        </select>
      </div>
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(r) => r.id}
        onRowClick={setSelected}
        loading={isLoading}
        emptyText="لا يوجد نشاط بعد"
        meta={data?.meta}
        onPage={setPage}
        pageSize={pageSize}
        onPageSize={setPageSize}
      />
    </>
  );
}
