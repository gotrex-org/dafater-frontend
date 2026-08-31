'use client';

import { useRef, useState } from 'react';
import { money, EGP, fmtDate } from '@/lib/format';
import { downloadElementAsPdf } from '@/lib/pdf';
import { PageTitle, Spinner, Field, MoneyInput } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useWindows } from '@/lib/windows';
import { useInvoice, useInvoiceSheet, useDeleteInvoice, useUpdateInvoiceCommission } from '../hooks';
import { confirmCascadeDelete } from '@/lib/cascadeDelete';
import type { Invoice } from '../dtos';
import { InvoiceEditor } from './InvoiceEditor';
import { CommissionPicker } from './CommissionPicker';
import { ManifestTabs } from './ManifestTabs';
import { InvoiceSheetBody, InvoiceSheetPayments } from './InvoiceSheet';

export function InvoiceDetail({ invoice, onBack }: { invoice: Invoice; onBack: () => void }) {
  const { can } = useAuth();
  const { open } = useWindows();
  const sheetRef = useRef<HTMLDivElement>(null);
  const total = invoice.items.reduce((s, it) => s + it.qty * it.price, 0);
  const discount = invoice.discount || 0;
  const netTotal = total - discount; // الصافي بعد الخصم
  const kindLabel = invoice.kind === 'SALE' ? 'بيع' : 'شراء';
  const isSale = invoice.kind === 'SALE';
  const cur = invoice.currency ?? invoice.party?.currency ?? 'EGP';

  const [showCommission, setShowCommission] = useState(false);
  const [commAmount, setCommAmount] = useState('');
  const [commPartyId, setCommPartyId] = useState('');
  const [commError, setCommError] = useState('');
  // فاتورة وهمية مالهاش حركات في الكشف — فأرقام الشيت (حساب قديم/سدادات/الباقي) متنطبقش عليها.
  const { data: sheet } = useInvoiceSheet(invoice.fake ? null : invoice.id);
  const deleteInvoice = useDeleteInvoice();
  const updateCommission = useUpdateInvoiceCommission();

  // الباقي عليه (بيع) / الباقي له (شراء) — بنقلب الإشارة في الشراء عشان يقرأ موجب لما نبقى مدينين.
  const sign = isSale ? 1 : -1;
  const remaining = sheet ? sign * sheet.remaining : null;
  const previousBalance = sheet ? sign * sheet.previousBalance : null;
  const cashTransfer = sheet ? sign * sheet.cashTransfer : 0;
  const expensesTotal = sheet ? sign * sheet.expensesTotal : 0;
  // اجمالي الفاتورة في الشيت شامل الحساب القديم (مجموع عمود «الاجمالي» كله).
  const sheetTotal = previousBalance !== null ? previousBalance + netTotal : null;
  // أي حركة تانية وقعت في نفس الفترة (مرتجع/خصم/مصروف على العميل) — بتفضل في كشف الحساب،
  // وبتتعرض هنا كسطر واحد عشان حسبة الورقة تقفل.
  const other = sheet && sheetTotal !== null && remaining !== null
    ? remaining - (sheetTotal + cashTransfer + expensesTotal - sheet.paymentsTotal)
    : 0;

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
        {invoice.fake && <span className="pill" style={{ background: 'var(--debit)', color: '#fff' }}>⚠️ فاتورة وهمية — مش مسجّلة في الحسابات</span>}
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

      {/* تابات العربيات — بره ورقة الفاتورة عشان ما تدخلش في الـ PDF/الطباعة */}
      <ManifestTabs invoiceId={invoice.id} />

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
          {cur === 'USD' && <div className="mf-info"><span className="mf-info-l">العملة</span><span className="mf-info-v" style={{ fontWeight: 700, color: 'var(--debit)' }}>دولار $</span></div>}
        </div>

        {/* جسم الفاتورة زي الشيت — مكوّن مشترك، عشان نفس الشكل بالحرف في تابات
            فواتير العميل وبوابة العميل كمان */}
        <InvoiceSheetBody
          items={invoice.items.map((it) => ({ name: it.product?.name ?? '—', qty: it.qty, price: it.price }))}
          cur={cur as 'EGP' | 'USD'}
          netTotal={netTotal}
          discount={discount}
          previousBalance={previousBalance}
          cashTransfer={cashTransfer}
          expensesTotal={expensesTotal}
          paymentsTotal={sheet ? sheet.paymentsTotal : null}
          other={other}
          remaining={remaining}
          isSale={isSale}
        />

        {sheet && sheet.payments.length > 0 && (
          <InvoiceSheetPayments
            cur={cur as 'EGP' | 'USD'}
            payments={sheet.payments.map((p) => ({ id: p.id, date: p.date, note: p.note || p.type, amount: p.amount }))}
            total={sheet.paymentsTotal}
            title={<>
              سدادات فاتورة {invoice.no}
              {sheet.nextInvoiceNo && <span className="muted"> — لحد فاتورة {sheet.nextInvoiceNo}</span>}
            </>}
          />
        )}

        {discount > 0 && (
          <div className="num" style={{ marginTop: 8, textAlign: 'left', fontWeight: 700 }}>
            الأصناف قبل الخصم: {money(total, cur)} · خصم: {money(discount, cur)}
          </div>
        )}
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
