'use client';

import { useRef, useState } from 'react';
import { money, EGP, fmtDate } from '@/lib/format';
import { downloadElementAsPdf } from '@/lib/pdf';
import { PageTitle, Spinner, Field, MoneyInput } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useWindows } from '@/lib/windows';
import { useParty } from '../../parties/hooks';
import { useInvoice, useDeleteInvoice, useUpdateInvoiceCommission } from '../hooks';
import { confirmCascadeDelete } from '@/lib/cascadeDelete';
import type { Invoice } from '../dtos';
import { InvoiceEditor } from './InvoiceEditor';
import { CommissionPicker } from './CommissionPicker';

export function InvoiceDetail({ invoice, onBack }: { invoice: Invoice; onBack: () => void }) {
  const { can } = useAuth();
  const { open } = useWindows();
  const sheetRef = useRef<HTMLDivElement>(null);
  const total = invoice.items.reduce((s, it) => s + it.qty * it.price, 0);
  const discount = invoice.discount || 0;
  const netTotal = total - discount; // الصافي بعد الخصم
  const kindLabel = invoice.kind === 'SALE' ? 'بيع' : 'شراء';
  const cur = invoice.currency ?? invoice.party?.currency ?? 'EGP';

  const [showPrev, setShowPrev] = useState(false);
  const [showCommission, setShowCommission] = useState(false);
  const [commAmount, setCommAmount] = useState('');
  const [commPartyId, setCommPartyId] = useState('');
  const [commError, setCommError] = useState('');
  const { data: party } = useParty(showPrev ? (invoice.party?.id ?? null) : null);
  const deleteInvoice = useDeleteInvoice();
  const updateCommission = useUpdateInvoiceCommission();

  const net = invoice.kind === 'SALE' ? netTotal - invoice.paid : -(netTotal - invoice.paid);
  const current = party?.balance ?? 0;
  const prev = current - net;

  const saveCommission = () => {
    setCommError('');
    if (!commPartyId) return setCommError('اختر صاحب commission');
    updateCommission.mutate(
      { id: invoice.id, dto: { commissionAmount: Number(commAmount) || undefined, commissionPartyId: commPartyId || undefined } },
      {
        onSuccess: () => { setShowCommission(false); setCommAmount(''); setCommPartyId(''); },
        onError: (e: any) => setCommError(e.message),
      },
    );
  };

  const openEdit = () => open({
    id: `invoice:${invoice.id}`,
    title: `تعديل فاتورة ${kindLabel} رقم ${invoice.no}`,
    render: (close) => <InvoiceEditor kind={invoice.kind} invoice={invoice} onClose={close} onUpdated={() => { close(); onBack(); }} />,
  });

  const handleDelete = () => {
    if (!window.confirm(`حذف فاتورة ${kindLabel} رقم ${invoice.no}؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    confirmCascadeDelete(deleteInvoice, invoice.id, { onSuccess: onBack });
  };

  return (
    <>
      <div className="toolbar no-print" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowPrev((v) => !v)}>{showPrev ? 'إخفاء الرصيد السابق' : 'إظهار الرصيد السابق'}</button>
        {can('invoices.edit') && (
          <button className="btn btn-ghost btn-sm" onClick={openEdit}>تعديل</button>
        )}
        {can('invoices.commission') && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCommission((v) => !v)}>commission</button>
        )}
        {can('invoices.delete') && (
          <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleteInvoice.isPending}>حذف</button>
        )}
        <button className="btn btn-ghost btn-sm sp" onClick={() => sheetRef.current && downloadElementAsPdf(sheetRef.current, `فاتورة-${invoice.no}`)}>⬇ تحميل PDF</button>
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
          <h2 style={{ fontSize: 18 }}>{invoice.party?.name ?? '—'}</h2>
          <div className="mf-meta">
            <span>فاتورة {kindLabel} رقم <b>{invoice.no}</b></span>
            <span>التاريخ: <b>{fmtDate(invoice.date)}</b></span>
          </div>
        </div>

        <div className="mf-grid">
          {invoice.warehouse?.name && <div className="mf-info"><span className="mf-info-l">المخزن</span><span className="mf-info-v">{invoice.warehouse.name}</span></div>}
          {invoice.paid > 0 && <div className="mf-info"><span className="mf-info-l">المدفوع</span><span className="mf-info-v">{money(invoice.paid, cur)}</span></div>}
          {cur === 'USD' && <div className="mf-info"><span className="mf-info-l">العملة</span><span className="mf-info-v" style={{ fontWeight: 700, color: 'var(--debit)' }}>دولار $</span></div>}
        </div>

        <div className="tbl-wrap">
          <table>
            <thead><tr><th style={{ width: 90 }}>الكمية</th><th>الصنف</th><th style={{ width: 110 }}>السعر {cur === 'USD' ? '($)' : '(ج.م)'}</th><th style={{ width: 120 }}>الإجمالي</th></tr></thead>
            <tbody>
              {invoice.items.map((it, i) => (
                <tr key={it.id ?? i}>
                  <td className="num">{it.qty}</td>
                  <td>{it.product?.name ?? '—'}</td>
                  <td className="num">{money(it.price, cur)}</td>
                  <td className="num">{money(it.qty * it.price, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showPrev && party && (
          <div className="num" style={{ marginTop: 8, textAlign: 'left', fontWeight: 700 }}>
            الرصيد السابق: {money(prev, cur)} · الرصيد بعد الفاتورة: {money(current, cur)}
          </div>
        )}

        {discount > 0 && (
          <div className="num" style={{ textAlign: 'left', fontWeight: 700 }}>
            الإجمالي: {money(total, cur)} · خصم: {money(discount, cur)}
          </div>
        )}
        <div className="page-title num" style={{ marginTop: discount > 0 ? 2 : 12, textAlign: 'left' }}>{discount > 0 ? 'صافي الفاتورة' : 'إجمالي الفاتورة'}: {money(netTotal, cur)}</div>
        {cur === 'USD' && !!invoice.exchangeRate && (
          <div className="num" style={{ textAlign: 'left', fontWeight: 700, color: 'var(--debit)' }}>
            بالمصري (سعر {EGP(invoice.exchangeRate)}): {EGP(total * invoice.exchangeRate)} ج.م
          </div>
        )}

        <div className="mf-grow" />
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 8 }} />
      </div>
    </>
  );
}

/** Loads an invoice by its public uid then renders its detail (used from the ledger). */
export function InvoiceDetailById({ uid, onBack }: { uid: string; onBack: () => void }) {
  const { data, isLoading } = useInvoice(uid);
  if (isLoading || !data) return <Spinner />;
  return <InvoiceDetail invoice={data} onBack={onBack} />;
}
