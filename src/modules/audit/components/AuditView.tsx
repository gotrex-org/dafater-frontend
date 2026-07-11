'use client';

import { useState } from 'react';
import { useTableState } from '@/lib/useTableState';
import { money } from '@/lib/format';
import { PageTitle, DataTable, type Column } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useUsers } from '../../users/hooks';
import { RecordOpener, canOpenRecord } from '../../records/RecordOpener';
import { useAudit, useUndoAudit } from '../hooks';
import { colorFor, rowTint } from '@/lib/userColor';
import type { AuditLog } from '../dtos';

const FIELD_LABELS: Record<string, string> = {
  date: 'التاريخ', paid: 'المدفوع', note: 'البيان / ملاحظة',
  name: 'الاسم', phone: 'التليفون',
  clientName: 'العميل', driverName: 'السائق',
  vehicleNo: 'رقم العربية', trailerNo: 'رقم المقطورة',
  agreedFreight: 'الناولون المتفق', unit: 'الوحدة', status: 'الحالة',
  items: 'الأصناف', qty: 'الكمية', no: 'الرقم', price: 'السعر', buyPrice: 'سعر الشراء',
  transactions: 'الحركات المالية', payments: 'المدفوعات', requests: 'الطلبات',
  debit: 'عليه', credit: 'له', cashIn: 'وارد', cashOut: 'صادر',
  type: 'النوع', amount: 'المبلغ', paymentType: 'نوع الدفعة', received: 'المستلم',
  opening: 'الرصيد الافتتاحي', currency: 'العملة', role: 'النوع الأساسي',
  service: 'بند خدمة',
  product: 'الصنف', warehouse: 'المخزن', party: 'الطرف', client: 'العميل', supplier: 'المورد',
  treasury: 'الخزنة', treasury2: 'الخزنة الأخرى', category: 'البند', kind: 'النوع',
  borrowerName: 'اسم المستلم', returnedQty: 'الكمية المرتجعة', cashReturnedQty: 'المسوّى نقدًا',
  returnType: 'نوع الإرجاع', returnDate: 'تاريخ الإرجاع', direction: 'الاتجاه',
  commissionAmount: 'قيمة العمولة', commissionTo: 'العمولة لصالح', nawlon: 'الناولون',
  paidIn: 'محصّل', paidOut: 'مدفوع', expAmt: 'مبلغ إضافي',
};

const ENTITY: Record<string, string> = {
  invoices: 'فاتورة', manifests: 'كشف عربية', parties: 'حساب/طرف', products: 'صنف', requests: 'طلب',
  deals: 'بيع خارجي', adjustments: 'تسوية مخزن', treasury: 'خزينة', transactions: 'حركة',
  warehouses: 'مخزن', 'expense-categories': 'بند مصروف', users: 'مستخدم', orders: 'طلبية عميل',
  config: 'إعدادات', 'driver-trips': 'رحلة سائق', drivers: 'سائق', loans: 'سلفة',
  'dollar-agents': 'وكيل دولار',
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

const UNDO_LABEL: Record<string, { btn: string; confirm: string }> = {
  CREATE: { btn: 'إلغاء الإضافة', confirm: 'سيتم حذف هذا العنصر نهائياً. متأكد؟' },
  DELETE: { btn: 'استرجاع المحذوف', confirm: 'سيتم استرجاع هذا العنصر. متأكد؟' },
};

// Raw internal ids (numeric PK, and un-nameable FK scalars like `partyId`) are noise here —
// the actual related record (e.g. `party: {name}`) is already included in the snapshot
// wherever it matters, so hiding the bare *Id columns doesn't lose information. We also
// drop plumbing arrays (the auto-generated ledger movements attached to an invoice, a
// party's whole transaction history, …) and internal bookkeeping fields, so the detail
// shows the business facts and nothing else.
const SNAPSHOT_SKIP_KEYS = new Set([
  'id', 'uid', 'createdAt', 'updatedAt', 'createdById', 'updatedById',
  'transactions', 'transactionsAlt', 'payments', 'returns', 'txs', 'requests',
  'groupId', 'tokenVersion', 'pinHash', 'pin', 'commissionPartyId',
]);
const isSkippableKey = (key: string, value: unknown) =>
  SNAPSHOT_SKIP_KEYS.has(key) || (/Id$/.test(key) && (value === null || typeof value !== 'object'));

function formatScalar(v: unknown): string {
  if (v == null) return '(فارغ)';
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    try { return new Date(v).toLocaleDateString('ar-EG'); } catch { return v; }
  }
  return String(v);
}

function SnapshotValue({ value, depth = 0 }: { value: any; depth?: number }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="muted" style={{ fontSize: 13 }}>—</span>;
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        {value.map((item, i) => (
          <div key={i} style={{ border: '1px solid var(--line-soft)', borderRadius: 6, padding: 8 }}>
            <SnapshotValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([k, v]) => !isSkippableKey(k, v));
    if (entries.length === 0) return <span className="muted" style={{ fontSize: 13 }}>—</span>;
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: depth === 0 ? 'auto 1fr' : '1fr', gap: '2px 16px', alignItems: 'baseline' }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{FIELD_LABELS[k] ?? k}</span>
            {v && typeof v === 'object' ? <SnapshotValue value={v} depth={depth + 1} /> : <span style={{ fontSize: 13 }}>{formatScalar(v)}</span>}
          </div>
        ))}
      </div>
    );
  }
  return <span style={{ fontSize: 13 }}>{formatScalar(value)}</span>;
}

// Clean line-item view for an invoice/deal snapshot — just the goods (الكمية/الصنف/
// السعر/الإجمالي) plus the money line, instead of dumping every internal field.
function InvoiceItemsDetail({ snap }: { snap: any }) {
  const items: any[] = Array.isArray(snap?.items) ? snap.items : [];
  const cur: 'USD' | 'EGP' = snap?.currency === 'USD' ? 'USD' : 'EGP';
  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const paid = Number(snap?.paid) || 0;
  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 10 }}>تفاصيل الفاتورة</div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th style={{ width: 80 }}>الكمية</th><th>الصنف</th><th style={{ width: 110 }}>السعر</th><th style={{ width: 120 }}>الإجمالي</th></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td className="num">{it.qty}</td>
                <td>{it.product?.name ?? '—'}</td>
                <td className="num">{money(Number(it.price) || 0, cur)}</td>
                <td className="num">{money((Number(it.qty) || 0) * (Number(it.price) || 0), cur)}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="empty">لا توجد أصناف</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="num" style={{ marginTop: 8, textAlign: 'left', fontWeight: 700 }}>
        الإجمالي: {money(total, cur)}{paid > 0 ? ` · المدفوع: ${money(paid, cur)}` : ''}
      </div>
    </div>
  );
}

function AuditDetail({ log, onBack, onOpen }: { log: AuditLog; onBack: () => void; onOpen: (entity: string, uid: string) => void }) {
  const { user } = useAuth();
  const undoAudit = useUndoAudit();
  const [confirm, setConfirm] = useState(false);
  const [undoErr, setUndoErr] = useState('');

  const canUndo = user?.admin && (
    (log.action === 'CREATE' && !!log.entityUid) ||
    (log.action === 'DELETE' && !!log.snapshot)
  );

  // A deleted record no longer exists, so it can't be opened — only CREATE/UPDATE
  // entries for entities that have a per-record view can deep-link to the original.
  const canGo = log.action !== 'DELETE' && canOpenRecord(log.entity, log.entityUid);

  const handleUndo = () => {
    setUndoErr('');
    undoAudit.mutate(log.id, {
      onSuccess: onBack,
      onError: (e: any) => { setConfirm(false); setUndoErr(e.message ?? 'حدث خطأ'); },
    });
  };

  const undoLabels = UNDO_LABEL[log.action];

  return (
    <>
      <div className="toolbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع للسجل</button>
        {canGo && (
          <button className="btn btn-primary btn-sm" onClick={() => onOpen(log.entity, log.entityUid!)}>
            فتح السجل الأصلي ←
          </button>
        )}
        {canUndo && (
          confirm ? (
            <>
              <span className="muted" style={{ fontSize: 13 }}>{undoLabels.confirm}</span>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--debit)', color: '#fff' }}
                onClick={handleUndo}
                disabled={undoAudit.isPending}
              >
                {undoAudit.isPending ? '...' : 'نعم، تأكيد'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>إلغاء</button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--debit)' }} onClick={() => setConfirm(true)}>
              {undoLabels.btn}
            </button>
          )
        )}
      </div>
      {undoErr && <div className="err-text" style={{ margin: '8px 0' }}>{undoErr}</div>}
      <div className="card" style={{ padding: 20, maxWidth: 680 }}>
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

        {log.snapshot && (
          (log.entity === 'invoices' || log.entity === 'deals')
            ? <InvoiceItemsDetail snap={log.snapshot} />
            : (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 10 }}>
                  {log.action === 'DELETE' ? 'بيانات العنصر المحذوف' : 'بيانات العنصر'}
                </div>
                <SnapshotValue value={log.snapshot} />
              </div>
            )
        )}

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
  const [target, setTarget] = useState<{ entity: string; uid: string } | null>(null);
  const [restoreErr, setRestoreErr] = useState('');
  const { user: authUser } = useAuth();
  const { data: users } = useUsers();
  const { data, isLoading } = useAudit({ page, pageSize, user: user || undefined });
  const undoAudit = useUndoAudit();

  if (target) return <RecordOpener entity={target.entity} uid={target.uid} onClose={() => setTarget(null)} />;
  if (selected) return <AuditDetail log={selected} onBack={() => setSelected(null)} onOpen={(entity, uid) => setTarget({ entity, uid })} />;

  const handleRestore = (log: AuditLog, e: React.MouseEvent) => {
    e.stopPropagation();
    const label = `${ENTITY[log.entity] ?? log.entity}${log.summary ? ` — ${log.summary}` : ''}`;
    if (!window.confirm(`استرجاع "${label}"؟`)) return;
    setRestoreErr('');
    undoAudit.mutate(log.id, {
      onError: (err: any) => setRestoreErr(err.message ?? 'حدث خطأ'),
    });
  };

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
    {
      header: '',
      cell: (r) => {
        if (!authUser?.admin || r.action !== 'DELETE' || !r.snapshot) return null;
        return (
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--credit)', fontWeight: 700, whiteSpace: 'nowrap' }}
            onClick={(e) => handleRestore(r, e)}
            disabled={undoAudit.isPending}
          >
            ↩ استرجاع
          </button>
        );
      },
    },
  ];

  return (
    <>
      <PageTitle title="سجل النشاط" subtitle="كل التعديلات اللي بتحصل في النظام — مين عمل إيه وإمتى" />
      {restoreErr && (
        <div className="err-text" style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(178,58,46,.08)', borderRadius: 8 }}>
          {restoreErr}
        </div>
      )}
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
        // Colour the whole row per user (a soft, light wash of their colour) so each
        // user's activity is instantly distinguishable at a glance.
        rowStyle={(r) => ({ background: rowTint(r.userName) })}
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
