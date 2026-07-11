'use client';

import { useState } from 'react';
import { EGP, fmtDate } from '@/lib/format';
import { useTableState } from '@/lib/useTableState';
import { useAuth } from '@/lib/auth';
import { useInvoiceDrafts } from '@/lib/invoiceDrafts';
import { PageTitle, DataTable, SegmentedControl, SearchInput, type Column } from '@/components/common';
import { useInvoices } from '../hooks';
import type { Invoice, InvoiceKind } from '../dtos';
import { InvoiceEditor } from './InvoiceEditor';
import { InvoiceDetail } from './InvoiceDetail';

const invoiceTotal = (inv: Invoice) => inv.items.reduce((s, it) => s + it.qty * it.price, 0);

export function InvoicesView() {
  const { can } = useAuth();
  const { minimize } = useInvoiceDrafts();
  const [kind, setKind] = useState<InvoiceKind>('SALE');
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const canCreate = kind === 'SALE' ? can('invoices.createSale') : can('invoices.createPurchase');
  const { page, setPage, pageSize, setPageSize } = useTableState();
  const { data, isLoading } = useInvoices({ kind, page, pageSize, search: search || undefined, from: from || undefined, to: to || undefined });

  if (editing) return (
    <InvoiceEditor
      kind={kind}
      onClose={() => setEditing(false)}
      onMinimize={(dft) => { minimize(dft); setEditing(false); }}
    />
  );
  if (selected) return <InvoiceDetail invoice={selected} onBack={() => setSelected(null)} />;

  const columns: Column<Invoice>[] = [
    { header: 'رقم', cell: (inv) => inv.no },
    { header: 'التاريخ', cell: (inv) => fmtDate(inv.date) },
    { header: kind === 'SALE' ? 'العميل' : 'المورد', cell: (inv) => inv.party?.name },
    { header: 'المخزن', cell: (inv) => inv.warehouse?.name, className: 'muted' },
    { header: 'الإجمالي', cell: (inv) => EGP(invoiceTotal(inv)), className: 'num' },
    { header: 'مدفوع', cell: (inv) => EGP(inv.paid), className: 'num cre' },
  ];

  return (
    <>
      <PageTitle title="الفواتير" subtitle="البيع ينقّص المخزن ويسجّل على العميل · الشراء يزوّد المخزن ويسجّل للمورد" />
      <div className="toolbar">
        <SegmentedControl
          value={kind}
          onChange={(v) => { setKind(v); setPage(1); }}
          options={[
            { value: 'SALE', label: 'فواتير بيع' },
            { value: 'PURCHASE', label: 'فواتير شراء' },
          ]}
        />
        {canCreate && <button className="btn btn-primary btn-sm sp" onClick={() => setEditing(true)}>+ فاتورة جديدة</button>}
      </div>
      <div className="toolbar" style={{ marginTop: 6, flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="بحث باسم العميل أو رقم الفاتورة…" />
        <span className="muted" style={{ fontSize: 12 }}>من</span>
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        <span className="muted" style={{ fontSize: 12 }}>إلى</span>
        <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        {(search || from || to) && <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFrom(''); setTo(''); setPage(1); }}>× مسح</button>}
      </div>
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(inv) => inv.id}
        onRowClick={setSelected}
        loading={isLoading}
        emptyText="لا توجد فواتير"
        meta={data?.meta}
        onPage={setPage}
        pageSize={pageSize}
        onPageSize={setPageSize}
      />
    </>
  );
}
