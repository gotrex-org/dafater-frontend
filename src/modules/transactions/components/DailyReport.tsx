'use client';

import { useState } from 'react';
import { todayISO, EGP, fmtDate } from '@/lib/format';
import { useTableState } from '@/lib/useTableState';
import { useAuth } from '@/lib/auth';
import { PageTitle, DataTable, SearchInput, SegmentedControl, type Column } from '@/components/common';
import { ReportsView } from '../../reports/components/ReportsView';
import { useInvoices } from '../../invoices/hooks';
import { RecordOpener } from '../../records/RecordOpener';
import { colorFor, rowTint } from '@/lib/userColor';
import { useTransactions, useDeleteTransaction } from '../hooks';
import { EditTransactionModal } from './EditTransactionModal';
import type { Transaction } from '../dtos';

function TxnDetail({
  txn, onBack, onEdit, onDelete, onOpen, can,
}: {
  txn: Transaction;
  onBack: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  onOpen: (entity: string, uid: string) => void;
  can: (p: string) => boolean;
}) {
  const rows: { label: string; value: React.ReactNode; cls?: string }[] = [
    { label: 'التاريخ', value: fmtDate(txn.date) },
    ...(txn.party ? [{ label: 'الطرف', value: txn.party.name }] : []),
    ...(txn.treasury ? [{ label: 'الخزنة', value: txn.treasury.name }] : []),
    ...(txn.note ? [{ label: 'البيان', value: txn.note }] : []),
    ...(txn.debit ? [{ label: 'عليه', value: EGP(txn.debit), cls: 'num deb' }] : []),
    ...(txn.credit ? [{ label: 'له', value: EGP(txn.credit), cls: 'num cre' }] : []),
    ...((txn.cashIn ?? 0) > 0 ? [{ label: 'داخل الخزنة', value: EGP(txn.cashIn!), cls: 'num cre' }] : []),
    ...((txn.cashOut ?? 0) > 0 ? [{ label: 'خارج الخزنة', value: EGP(txn.cashOut!), cls: 'num deb' }] : []),
  ];

  return (
    <>
      <div className="toolbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع للتقرير</button>
        {txn.invoiceId && (
          <button className="btn btn-primary btn-sm" onClick={() => onOpen('invoices', txn.invoiceId!)}>فتح الفاتورة ←</button>
        )}
        {txn.dealId && (
          <button className="btn btn-primary btn-sm" onClick={() => onOpen('deals', txn.dealId!)}>فتح البيع الخارجي ←</button>
        )}
        {txn.party?.id && (
          <button className="btn btn-ghost btn-sm" onClick={() => onOpen('parties', txn.party!.id)}>فتح كشف الطرف ←</button>
        )}
        {!txn.invoiceId && !txn.dealId && can('entry') && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(txn)}>تعديل</button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(txn)}>حذف</button>
          </>
        )}
      </div>
      <div className="card" style={{ padding: 20, maxWidth: 480 }}>
        <div className="page-title" style={{ marginBottom: 16 }}>{txn.type}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 20px', alignItems: 'baseline' }}>
          {rows.map(({ label, value, cls }) => (
            <>
              <span className="muted" style={{ fontSize: 13 }}>{label}</span>
              <span className={cls ?? ''}>{value}</span>
            </>
          ))}
        </div>
      </div>
    </>
  );
}

function InventorySummary({ from, to }: { from: string; to: string }) {
  const { data } = useInvoices({ kind: 'PURCHASE', from: from || undefined, to: to || undefined, all: true } as any);
  const invoices = data?.data ?? [];
  const byProduct = new Map<string, { name: string; qty: number; unit?: string }>();
  for (const inv of invoices) {
    for (const it of inv.items) {
      const key = it.product?.name ?? it.productId;
      const ex = byProduct.get(key) ?? { name: key, qty: 0 };
      byProduct.set(key, { ...ex, qty: ex.qty + it.qty });
    }
  }
  const entries = [...byProduct.values()];
  if (!entries.length) return null;
  return (
    <div className="card" style={{ padding: '12px 16px', marginBottom: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>واردات المخزن في الفترة</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
        {entries.map((e) => (
          <span key={e.name} style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 700 }} className="num">{e.qty}</span>
            <span className="muted" style={{ marginRight: 4 }}>{e.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function DailyReport() {
  const { can, user } = useAuth();
  const isPrimary = !!user?.isPrimary;
  const [tab, setTab] = useState<'today' | 'reports'>('today');
  const today = todayISO();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<{ entity: string; uid: string } | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const { page, setPage, pageSize, setPageSize } = useTableState();
  const { data, isLoading } = useTransactions({ from: from || undefined, to: to || undefined, search: search || undefined, page, pageSize });
  const deleteTxn = useDeleteTransaction();

  if (target) return <RecordOpener entity={target.entity} uid={target.uid} onClose={() => setTarget(null)} />;

  // Owner-only reports tab, tucked inside تقرير اليوم to keep the top nav short.
  const tabBar = isPrimary ? (
    <div className="toolbar" style={{ marginBottom: 4 }}>
      <SegmentedControl
        value={tab}
        onChange={(v) => setTab(v as 'today' | 'reports')}
        options={[{ value: 'today', label: 'حركات اليوم' }, { value: 'reports', label: 'التقارير' }]}
      />
    </div>
  ) : null;

  if (isPrimary && tab === 'reports') {
    return (
      <>
        <PageTitle title="تقرير اليوم" />
        {tabBar}
        <ReportsView embedded />
      </>
    );
  }

  const handleDelete = (txn: Transaction, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm(`حذف الحركة "${txn.type}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    deleteTxn.mutate(txn.id, { onSuccess: () => setSelected(null) });
  };

  if (selected) {
    return (
      <>
        {editing && <EditTransactionModal txn={editing} onClose={() => setEditing(null)} />}
        <TxnDetail
          txn={selected}
          onBack={() => setSelected(null)}
          onEdit={(t) => setEditing(t)}
          onDelete={handleDelete}
          onOpen={(entity, uid) => { setSelected(null); setTarget({ entity, uid }); }}
          can={can}
        />
      </>
    );
  }

  const cols: Column<Transaction>[] = [
    { header: 'النوع', cell: (r) => r.type },
    { header: 'المستخدم', cell: (r) => r.createdBy?.name ? <b style={{ color: colorFor(r.createdBy.name) }}>{r.createdBy.name}</b> : <span className="muted">—</span> },
    { header: 'الطرف', cell: (r) => r.party?.name ?? r.treasury?.name ?? '—', className: 'muted' },
    { header: 'البيان', cell: (r) => r.note ?? '', className: 'muted' },
    { header: 'عليه', cell: (r) => (r.debit ? EGP(r.debit) : ''), className: 'num deb' },
    { header: 'له', cell: (r) => (r.credit ? EGP(r.credit) : ''), className: 'num cre' },
    { header: 'داخل الخزنة', cell: (r) => (r.cashIn ? EGP(r.cashIn) : ''), className: 'num cre' },
    { header: 'خارج الخزنة', cell: (r) => (r.cashOut ? EGP(r.cashOut) : ''), className: 'num deb' },
    {
      header: '',
      cell: (r) => !r.invoiceId && !r.dealId && (can('entry.edit') || can('entry.delete')) ? (
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          {can('entry.edit') && <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>تعديل</button>}
          {can('entry.delete') && <button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(r, e)} disabled={deleteTxn.isPending}>حذف</button>}
        </div>
      ) : null,
    },
  ];

  return (
    <>
      {editing && <EditTransactionModal txn={editing} onClose={() => setEditing(null)} />}
      <PageTitle title="تقرير الحركات" subtitle="الحركات في الفترة المحددة — يمكن البحث أو تحديد نطاق تاريخ" />
      {tabBar}
      <div className="toolbar" style={{ flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="بحث بالنوع أو البيان أو الطرف…" />
        <span className="muted" style={{ fontSize: 12 }}>من</span>
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        <span className="muted" style={{ fontSize: 12 }}>إلى</span>
        <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        {(search || (from !== today) || (to !== today)) && <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFrom(today); setTo(today); setPage(1); }}>× اليوم</button>}
      </div>
      <InventorySummary from={from} to={to} />
      <DataTable
        columns={cols}
        rows={data?.data ?? []}
        rowKey={(r) => r.id}
        rowStyle={(r) => ({ background: rowTint(r.createdBy?.name) })}
        onRowClick={setSelected}
        loading={isLoading}
        emptyText="لا توجد حركات في هذه الفترة"
        meta={data?.meta}
        onPage={setPage}
        pageSize={pageSize}
        onPageSize={setPageSize}
      />
    </>
  );
}
