'use client';

import { useRef, useState } from 'react';
import { EGP, fmtDate } from '@/lib/format';
import { downloadElementAsPdf } from '@/lib/pdf';
import { useTableState } from '@/lib/useTableState';
import { useAuth } from '@/lib/auth';
import { useWindows } from '@/lib/windows';
import { PageTitle, DataTable, SearchInput, Spinner, Field, MoneyInput, type Column } from '@/components/common';
import { useDeals, useDeal, useDeleteDeal } from '../hooks';
import type { Deal } from '../dtos';
import { DealEditor } from './DealEditor';

// الإجمالي على العميل: الأصناف + بنود الشحن + ناولون العملية القديم
const sellTotal = (d: Deal) =>
  (d.items || []).reduce((s, it) => s + it.qty * it.price, 0)
  + (d.charges || []).reduce((s, c) => s + c.qty * c.price, 0)
  + (d.nawlon || 0);

export function DealDetailById({ uid, onBack }: { uid: string; onBack: () => void }) {
  const { data, isLoading } = useDeal(uid);
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  if (isLoading || !data) return <Spinner />;
  if (editing) return <DealEditor initialDeal={data} onClose={() => setEditing(false)} />;
  return <DealDetail deal={data} onBack={onBack} onEdit={can('deals.edit') ? () => setEditing(true) : undefined} />;
}

function DealDetail({ deal, onBack, onEdit, onDelete }: {
  deal: Deal;
  onBack: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  // زي الفاتورة: الأصناف، وتحتها بنود الشحن (جدول البنود + الأصناف الخدمية القديمة
  // + ناولون العملية القديم).
  const goods = deal.items.filter((it) => !it.product?.service);
  const services = [
    ...(deal.charges ?? []).map((c) => ({ id: c.id, name: c.chargeType?.name ?? '—', qty: c.qty, price: c.price })),
    ...deal.items.filter((it) => !!it.product?.service).map((it, i) => ({ id: it.id ?? `svc-${i}`, name: it.product?.name ?? '—', qty: it.qty, price: it.price })),
    ...((deal.nawlon ?? 0) > 0 ? [{ id: 'nawlon', name: 'ناولون', qty: 1, price: deal.nawlon }] : []),
  ];
  const goodsTotal = goods.reduce((s, it) => s + it.qty * it.price, 0);
  const servicesTotal = services.reduce((s, it) => s + it.qty * it.price, 0);


  return (
    <>
      <div className="toolbar no-print">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع للبيع الخارجي</button>
        {onEdit && <button className="btn btn-ghost btn-sm" onClick={onEdit}>تعديل</button>}
        {onDelete && <button className="btn btn-danger btn-sm" onClick={onDelete}>حذف</button>}
        <button className="btn btn-ghost btn-sm sp" onClick={() => sheetRef.current && downloadElementAsPdf(sheetRef.current, `بيع-خارجي-${deal.no}`)}>⬇ تحميل PDF</button>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 طباعة</button>
      </div>


      {/* نفس ورقة الفاتورة: الأصناف بإجماليها، وتحتها بنود الشحن بإجماليها. */}
      <div ref={sheetRef} className="card print-sheet inv-sheet">
        <div className="mf-logo">أبو شامة</div>
        <div className="mf-head">
          <h2 style={{ fontSize: 18 }}>{deal.client?.name ?? '—'}</h2>
          <div className="mf-meta">
            <span>فاتورة بيع رقم <b>{deal.no}</b></span>
            <span>التاريخ: <b>{fmtDate(deal.date)}</b></span>
          </div>
        </div>

        {(!!deal.manifests?.length || !!deal.driverTrip) && (
          <div className="mf-grid no-print">
            {deal.manifests?.map((m) => (
              <div key={m.id} className="mf-info"><span className="mf-info-l">كشف عربية</span><span className="mf-info-v">رقم {m.no}{m.vehicleNo ? ` — ${m.vehicleNo}` : ''}{m.driverName ? ` — ${m.driverName}` : ''}</span></div>
            ))}
            {deal.driverTrip && (
              <div className="mf-info"><span className="mf-info-l">رحلة السائق</span><span className="mf-info-v">{deal.driverTrip.driverName} — {fmtDate(deal.driverTrip.departureDate)}</span></div>
            )}
          </div>
        )}

        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>الصنف</th>
                <th className="num" style={{ width: 80 }}>العدد</th>
                <th className="num" style={{ width: 104 }}>السعر (ج.م)</th>
                <th className="num" style={{ width: 116 }}>الاجمالي</th>
              </tr>
            </thead>
            <tbody>
              {goods.map((it, i) => (
                <tr key={it.id ?? i}>
                  <td>{it.product?.name ?? '—'}</td>
                  <td className="num">{it.qty}</td>
                  <td className="num">{EGP(it.price)}</td>
                  <td className="num">{EGP(it.qty * it.price)}</td>
                </tr>
              ))}
              {services.length > 0 && (
                <tr className="inv-sub">
                  <td colSpan={3}>إجمالي الأصناف</td>
                  <td className="num">{EGP(goodsTotal)}</td>
                </tr>
              )}
              {services.map((it) => (
                <tr key={it.id} className="inv-bnd">
                  <td><span className="inv-bnd-tag">شحن</span>{it.name}</td>
                  <td className="num">{it.qty}</td>
                  <td className="num">{EGP(it.price)}</td>
                  <td className="num">{EGP(it.qty * it.price)}</td>
                </tr>
              ))}
              {services.length > 0 && (
                <tr className="inv-sub">
                  <td colSpan={3}>إجمالي بنود الشحن</td>
                  <td className="num">{EGP(servicesTotal)}</td>
                </tr>
              )}
              {goods.length === 0 && services.length === 0 && (
                <tr><td colSpan={4} className="empty">لا توجد أصناف في هذه العملية</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="inv-totals">
          <div className="r end"><span>الإجمالي</span><span className="num">{EGP(goodsTotal + servicesTotal)}</span></div>
        </div>

        <div className="mf-grow" />
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 8 }} />
      </div>
    </>
  );
}

export function DealsView() {
  const { can } = useAuth();
  const { open } = useWindows();
  const [selected, setSelected] = useState<Deal | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { page, setPage, pageSize, setPageSize } = useTableState();
  const { data, isLoading } = useDeals({ page, pageSize, search: search || undefined, from: from || undefined, to: to || undefined });
  const deleteDeal = useDeleteDeal();

  const handleDelete = (deal: Deal) => {
    if (!window.confirm(`حذف عملية #${deal.no}؟ هذا الإجراء لا يمكن التراجع عنه وسيحذف جميع الحركات المرتبطة.`)) return;
    deleteDeal.mutate(deal.id, { onSuccess: () => setSelected(null) });
  };

  const openNew = () => open({
    title: 'عملية بيع خارجي جديدة',
    render: (close) => <DealEditor onClose={close} />,
  });
  const openEdit = (deal: Deal) => open({
    id: `deal:${deal.id}`,
    title: `تعديل عملية رقم ${deal.no}`,
    render: (close) => <DealEditor initialDeal={deal} onClose={() => { close(); setSelected(null); }} />,
  });

  if (selected) return (
    <DealDetail
      deal={selected}
      onBack={() => setSelected(null)}
      onEdit={can('deals.edit') ? () => openEdit(selected) : undefined}
      onDelete={can('deals.delete') ? () => handleDelete(selected) : undefined}
    />
  );

  const columns: Column<Deal>[] = [
    { header: 'رقم', cell: (d) => d.no },
    { header: 'التاريخ', cell: (d) => fmtDate(d.date) },
    { header: 'المورد', cell: (d) => d.supplier?.name },
    { header: 'العميل', cell: (d) => d.client?.name },
    { header: 'الإجمالي', cell: (d) => EGP(sellTotal(d)), className: 'num' },
  ];

  return (
    <>
      <PageTitle title="البيع الخارجي" subtitle="شراء من المورد وبيع للعميل في نفس الوقت — بدون أثر على المخزن" />
      <div className="toolbar">
        {can('deals.create') && <button className="btn btn-primary btn-sm sp" onClick={openNew}>+ عملية جديدة</button>}
      </div>
      <div className="toolbar" style={{ marginTop: 6, flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="بحث باسم العميل أو المورد…" />
        <span className="muted" style={{ fontSize: 12 }}>من</span>
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        <span className="muted" style={{ fontSize: 12 }}>إلى</span>
        <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        {(search || from || to) && <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFrom(''); setTo(''); setPage(1); }}>× مسح</button>}
      </div>
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(d) => d.id}
        onRowClick={setSelected}
        loading={isLoading}
        emptyText="لا توجد عمليات"
        meta={data?.meta}
        onPage={setPage}
        pageSize={pageSize}
        onPageSize={setPageSize}
      />
    </>
  );
}
