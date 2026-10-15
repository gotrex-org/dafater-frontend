'use client';

import { useRef } from 'react';
import { money, EGP, fmtDate } from '@/lib/format';
import { downloadElementAsPdf } from '@/lib/pdf';
import { PageTitle, Spinner } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useWindows } from '@/lib/windows';
import { useInvoice, useDeleteInvoice } from '../hooks';
import { confirmCascadeDelete } from '@/lib/cascadeDelete';
import type { Invoice } from '../dtos';
import { InvoiceEditor } from './InvoiceEditor';

export function InvoiceDetail({ invoice, onBack }: { invoice: Invoice; onBack: () => void }) {
  const { can } = useAuth();
  const { open } = useWindows();
  const sheetRef = useRef<HTMLDivElement>(null);
  const discount = invoice.discount || 0;
  const kindLabel = invoice.kind === 'SALE' ? 'بيع' : 'شراء';
  const cur = invoice.currency ?? invoice.party?.currency ?? 'EGP';

  // الأصناف وبنود الشحن: البنود من جدول بنود الشحن (نولون / تحميل / شفتنة …)، ومعاها
  // الأصناف الخدمية القديمة (service). بتتعرض في قسم منفصل تحت الأصناف بإجمالي خاص بيها.
  const goods = invoice.items.filter((it) => !it.product?.service);
  const services = [
    ...(invoice.charges ?? []).map((c) => ({ id: c.id, qty: c.qty, price: c.price, product: { name: c.chargeType?.name ?? '—' } })),
    ...invoice.items.filter((it) => !!it.product?.service),
  ];
  const goodsTotal = goods.reduce((s, it) => s + it.qty * it.price, 0);
  const servicesTotal = services.reduce((s, it) => s + it.qty * it.price, 0);
  const total = goodsTotal + servicesTotal;
  const netTotal = total - discount; // الصافي بعد الخصم


  const deleteInvoice = useDeleteInvoice();


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
        {invoice.fake && <span className="pill" style={{ background: 'var(--debit)', color: '#fff' }}>فاتورة وهمية — غير مسجلة في الحسابات</span>}
        {can('invoices.edit') && (
          <button className="btn btn-ghost btn-sm" onClick={openEdit}>تعديل</button>
        )}
        {can('invoices.delete') && (
          <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleteInvoice.isPending}>حذف</button>
        )}
        <button className="btn btn-ghost btn-sm sp" onClick={() => sheetRef.current && downloadElementAsPdf(sheetRef.current, `فاتورة-${invoice.no}`)}>⬇ تحميل PDF</button>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 طباعة</button>
      </div>



      <div ref={sheetRef} className="card print-sheet inv-sheet">
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
          {cur === 'USD' && <div className="mf-info"><span className="mf-info-l">العملة</span><span className="mf-info-v" style={{ fontWeight: 700, color: 'var(--debit)' }}>دولار $</span></div>}
        </div>

        {/* جدول واحد: الأصناف الأول بإجماليها، وتحتها البنود بإجماليها. مكتوب هنا
            مباشرةً (مش InvoiceSheetBody المشترك) عشان بوابة العميل تفضل بشكلها. */}
        <div className="tbl-wrap">
          <table>
            <thead>
              {/* الصنف الأول وياخد الباقي، وتلات أعمدة الأرقام وراه مرتبين ورا بعض */}
              <tr>
                <th>الصنف</th>
                <th className="num" style={{ width: 80 }}>العدد</th>
                <th className="num" style={{ width: 104 }}>السعر {cur === 'USD' ? '($)' : '(ج.م)'}</th>
                <th className="num" style={{ width: 116 }}>الاجمالي</th>
              </tr>
            </thead>
            <tbody>
              {goods.map((it) => (
                <tr key={it.id}>
                  <td>{it.product?.name ?? '—'}</td>
                  <td className="num">{it.qty}</td>
                  <td className="num">{money(it.price, cur)}</td>
                  <td className="num">{money(it.qty * it.price, cur)}</td>
                </tr>
              ))}
              {/* الإجماليات الفرعية بتبان بس لما يكون فيه بنود — من غيرها الفاتورة
                  فيها رقم واحد وسطر «قبل الخصم» تحت بيكفّي. */}
              {services.length > 0 && (
                <tr className="inv-sub">
                  <td colSpan={3}>إجمالي الأصناف</td>
                  <td className="num">{money(goodsTotal, cur)}</td>
                </tr>
              )}
              {services.map((it) => (
                <tr key={it.id} className="inv-bnd">
                  <td><span className="inv-bnd-tag">شحن</span>{it.product?.name ?? '—'}</td>
                  <td className="num">{it.qty}</td>
                  <td className="num">{money(it.price, cur)}</td>
                  <td className="num">{money(it.qty * it.price, cur)}</td>
                </tr>
              ))}
              {services.length > 0 && (
                <tr className="inv-sub">
                  <td colSpan={3}>إجمالي بنود الشحن</td>
                  <td className="num">{money(servicesTotal, cur)}</td>
                </tr>
              )}
              {invoice.items.length === 0 && services.length === 0 && (
                <tr><td colSpan={4} className="empty">لا توجد أصناف في هذه الفاتورة</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="inv-totals">
          <div className="r"><span>قبل الخصم</span><span className="num">{money(total, cur)}</span></div>
          {discount > 0 && (
            <div className="r"><span>خصم</span><span className="num">− {money(discount, cur)}</span></div>
          )}
          <div className="r end"><span>الإجمالي</span><span className="num">{money(netTotal, cur)}</span></div>
        </div>

        {cur === 'USD' && !!invoice.exchangeRate && (
          <div className="num" style={{ textAlign: 'left', fontWeight: 700, color: 'var(--debit)', marginTop: 8 }}>
            بالمصري (سعر {EGP(invoice.exchangeRate)}): {EGP(netTotal * invoice.exchangeRate)} ج.م
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
