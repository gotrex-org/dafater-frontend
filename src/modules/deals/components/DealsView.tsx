'use client';

import { useRef, useState } from 'react';
import { EGP, fmtDate } from '@/lib/format';
import { downloadElementAsPdf } from '@/lib/pdf';
import { useTableState } from '@/lib/useTableState';
import { useAuth } from '@/lib/auth';
import { PageTitle, DataTable, SearchInput, Spinner, Field, MoneyInput, type Column } from '@/components/common';
import { CommissionPicker } from '../../invoices/components/CommissionPicker';
import { useDeals, useDeal, useDeleteDeal, useUpdateDealCommission } from '../hooks';
import type { Deal } from '../dtos';
import { DealEditor } from './DealEditor';

const sellTotal = (d: Deal) => (d.items || []).reduce((s, it) => s + it.qty * it.price, 0);

export function DealDetailById({ uid, onBack }: { uid: string; onBack: () => void }) {
  const { data, isLoading } = useDeal(uid);
  if (isLoading || !data) return <Spinner />;
  return <DealDetail deal={data} onBack={onBack} />;
}

function DealDetail({ deal, onBack, onEdit, onDelete }: {
  deal: Deal;
  onBack: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { can } = useAuth();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [showCommission, setShowCommission] = useState(false);
  const [commAmount, setCommAmount] = useState('');
  const [commPartyId, setCommPartyId] = useState('');
  const [commError, setCommError] = useState('');
  const updateCommission = useUpdateDealCommission();

  const saveCommission = () => {
    setCommError('');
    if (!commPartyId) return setCommError('اختر صاحب commission');
    updateCommission.mutate(
      { id: deal.id, dto: { commissionAmount: Number(commAmount) || undefined, commissionPartyId: commPartyId || undefined } },
      {
        onSuccess: () => { setShowCommission(false); setCommAmount(''); setCommPartyId(''); },
        onError: (e: any) => setCommError(e.message),
      },
    );
  };

  return (
    <>
      <div className="toolbar no-print">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع للبيع الخارجي</button>
        {onEdit && <button className="btn btn-ghost btn-sm" onClick={onEdit}>تعديل</button>}
        {can('invoices.commission') && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCommission((v) => !v)}>commission</button>
        )}
        {onDelete && <button className="btn btn-danger btn-sm" onClick={onDelete}>حذف</button>}
        <button className="btn btn-ghost btn-sm sp" onClick={() => sheetRef.current && downloadElementAsPdf(sheetRef.current, `بيع-خارجي-${deal.no}`)}>⬇ تحميل PDF</button>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 طباعة</button>
      </div>

      {showCommission && can('invoices.commission') && (
        <div className="card no-print" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>إضافة / تعديل commission</div>
          <div className="form-grid">
            <Field label="مبلغ commission">
              <MoneyInput value={commAmount} onChange={setCommAmount} placeholder="0.00" />
            </Field>
            <Field label="لصالح">
              <CommissionPicker value={commPartyId} onChange={setCommPartyId} />
            </Field>
          </div>
          {commError && <div className="err-text">{commError}</div>}
          <div className="toolbar" style={{ marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={saveCommission} disabled={updateCommission.isPending}>
              {updateCommission.isPending ? '...' : 'حفظ'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowCommission(false); setCommError(''); }}>إلغاء</button>
          </div>
        </div>
      )}

      <div ref={sheetRef} className="card print-sheet">
        <div className="mf-logo">أبو شامة</div>
        <div className="mf-head">
          <h2>{deal.client?.name ?? '—'}</h2>
          <div className="mf-meta">
            <span>فاتورة رقم <b>{deal.no}</b></span>
            <span>التاريخ: <b>{fmtDate(deal.date)}</b></span>
          </div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th style={{ width: 90 }}>الكمية</th><th>الصنف</th><th style={{ width: 110 }}>السعر</th><th style={{ width: 120 }}>الإجمالي</th></tr></thead>
            <tbody>
              {deal.items.map((it, i) => (
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
        <div style={{ marginTop: 12, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <div className="page-title num">إجمالي البضاعة: {EGP(sellTotal(deal))}</div>
          {(deal.nawlon ?? 0) > 0 && (
            <div className="num" style={{ fontSize: 14 }}>ناولون: {EGP(deal.nawlon)}</div>
          )}
          {(deal.nawlon ?? 0) > 0 && (
            <div className="page-title num" style={{ borderTop: '1px solid var(--line)', paddingTop: 4 }}>
              الإجمالي الكلي: {EGP(sellTotal(deal) + (deal.nawlon ?? 0))}
            </div>
          )}
          {!(deal.nawlon ?? 0) && <div className="page-title num">الإجمالي: {EGP(sellTotal(deal))}</div>}
        </div>
        <div className="mf-grow" />
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 8 }} />
      </div>
    </>
  );
}

export function DealsView() {
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
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

  if (editingDeal) return <DealEditor initialDeal={editingDeal} onClose={() => { setEditingDeal(null); setSelected(null); }} />;
  if (editing) return <DealEditor onClose={() => setEditing(false)} />;
  if (selected) return (
    <DealDetail
      deal={selected}
      onBack={() => setSelected(null)}
      onEdit={can('deals.edit') ? () => setEditingDeal(selected) : undefined}
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
        {can('deals.create') && <button className="btn btn-primary btn-sm sp" onClick={() => setEditing(true)}>+ عملية جديدة</button>}
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
