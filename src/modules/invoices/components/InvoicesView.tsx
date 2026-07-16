'use client';

import { useState } from 'react';
import { EGP, fmtDate } from '@/lib/format';
import { useTableState } from '@/lib/useTableState';
import { useAuth } from '@/lib/auth';
import { useWindows } from '@/lib/windows';
import { PageTitle, DataTable, SegmentedControl, SearchInput, type Column } from '@/components/common';
import { useInvoices } from '../hooks';
import type { Invoice, InvoiceKind } from '../dtos';
import { InvoiceEditor } from './InvoiceEditor';
import { InvoiceDetail } from './InvoiceDetail';
import { ReturnsView } from '../../returns/components/ReturnsView';
import { DiscountsView } from '../../discounts/components/DiscountsView';
import { DealsView } from '../../deals/components/DealsView';

const invoiceTotal = (inv: Invoice) => inv.items.reduce((s, it) => s + it.qty * it.price, 0);

export function InvoicesView() {
  const { can } = useAuth();
  const { open } = useWindows();
  const [section, setSection] = useState<'invoices' | 'returns' | 'discounts' | 'deals'>('invoices');
  const [kind, setKind] = useState<InvoiceKind>('SALE');
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const canCreate = kind === 'SALE' ? can('invoices.createSale') : can('invoices.createPurchase');
  const { page, setPage, pageSize, setPageSize } = useTableState();
  const { data, isLoading } = useInvoices({ kind, page, pageSize, search: search || undefined, from: from || undefined, to: to || undefined });

  const openNew = () => open({
    title: kind === 'SALE' ? 'فاتورة بيع جديدة' : 'فاتورة شراء جديدة',
    render: (close) => <InvoiceEditor kind={kind} onClose={close} />,
  });

  if (section === 'invoices' && selected) return <InvoiceDetail invoice={selected} onBack={() => setSelected(null)} />;

  const sectionSwitch = (
    <div className="toolbar">
      <SegmentedControl
        value={section}
        onChange={(v) => setSection(v as typeof section)}
        options={[
          { value: 'invoices', label: 'الفواتير' },
          { value: 'deals', label: 'البيع الخارجي' },
          { value: 'returns', label: 'المرتجعات' },
          { value: 'discounts', label: 'الخصومات' },
        ]}
      />
    </div>
  );

  if (section === 'returns' || section === 'discounts' || section === 'deals') {
    return (
      <>
        <PageTitle title="الفواتير" />
        {sectionSwitch}
        {section === 'returns' ? <ReturnsView /> : section === 'discounts' ? <DiscountsView /> : <DealsView />}
      </>
    );
  }

  const columns: Column<Invoice>[] = [
    { header: 'رقم', cell: (inv) => <span>{inv.no} {inv.fake && <span className="pill" style={{ background: 'var(--debit)', color: '#fff', fontSize: 10 }}>وهمية</span>}</span> },
    { header: 'التاريخ', cell: (inv) => fmtDate(inv.date) },
    { header: kind === 'SALE' ? 'العميل' : 'المورد', cell: (inv) => inv.party?.name },
    { header: 'المخزن', cell: (inv) => inv.warehouse?.name, className: 'muted' },
    { header: 'الإجمالي', cell: (inv) => EGP(invoiceTotal(inv)), className: 'num' },
    { header: 'مدفوع', cell: (inv) => EGP(inv.paid), className: 'num cre' },
  ];

  return (
    <>
      <PageTitle title="الفواتير والمرتجعات" subtitle="البيع ينقّص المخزن ويسجّل على العميل · الشراء يزوّد المخزن ويسجّل للمورد" />
      {sectionSwitch}
      <div className="toolbar">
        <SegmentedControl
          value={kind}
          onChange={(v) => { setKind(v); setPage(1); }}
          options={[
            { value: 'SALE', label: 'فواتير بيع' },
            { value: 'PURCHASE', label: 'فواتير شراء' },
          ]}
        />
        {canCreate && <button className="btn btn-primary btn-sm sp" onClick={openNew}>+ فاتورة جديدة</button>}
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
