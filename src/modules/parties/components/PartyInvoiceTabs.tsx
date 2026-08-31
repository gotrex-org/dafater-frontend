'use client';

import { useState } from 'react';
import { money, fmtDate } from '@/lib/format';
import { Spinner } from '@/components/common';
import { useInvoices, useInvoiceSheet } from '../../invoices/hooks';
import { ManifestTabs } from '../../invoices/components/ManifestTabs';
import { InvoiceSheetBody, InvoiceSheetPayments } from '../../invoices/components/InvoiceSheet';
import type { Invoice } from '../../invoices/dtos';
import type { Party } from '../dtos';

/**
 * تابات فواتير العميل — لكل فاتورة تابين ورا بعض: «فاتورة N» و«استلامات N» بنفس
 * الرقم. الاستلامات بتاعة الفترة نفسها: من الفاتورة دي لحد الفاتورة اللي بعدها
 * (الباك بيحسبها في sheet()). وجوّه تاب الفاتورة عربياتها بأصنافها ومصاريفها.
 *
 * يعني المستويات: العميل ← فاتورة/استلامات ← عربية.
 */
type TabKind = 'invoice' | 'receipts';

export function PartyInvoiceTabs({ party, onOpenInvoice }: { party: Party; onOpenInvoice: (uid: string) => void }) {
  // كل فواتير الطرف — الفلتر بالـ uid مش بالبحث بالاسم عشان ما يتلغبطش مع اسم مشابه.
  const { data, isLoading } = useInvoices({ partyId: party.id, pageSize: 200 });
  const [active, setActive] = useState(0);

  // الأقدم الأول عشان ترتيب التابات يمشي مع ترتيب الفواتير الطبيعي (فاتورة ١، ٢، ٣…)
  const invoices: Invoice[] = [...(data?.data ?? [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  // تاب الفاتورة وبعديه على طول تاب استلاماتها بنفس الرقم
  const tabs: { inv: Invoice; kind: TabKind }[] = invoices.flatMap((inv) => [
    { inv, kind: 'invoice' as TabKind },
    { inv, kind: 'receipts' as TabKind },
  ]);
  const cursor = tabs.length ? tabs[Math.min(active, tabs.length - 1)] : null;
  const inv = cursor?.inv ?? null;

  // أرقام الشيت (سدادات الفترة + الفاتورة اللي بعدها). الوهمية مالهاش حركات.
  const { data: sheet, isLoading: loadingSheet } = useInvoiceSheet(inv && !inv.fake ? inv.id : null);

  if (isLoading) return <Spinner />;
  if (!cursor || !inv) {
    return <div className="card" style={{ padding: 22 }}><div className="empty">مفيش فواتير للعميل ده</div></div>;
  }

  const cur = inv.currency ?? party.currency ?? 'EGP';
  const total = inv.items.reduce((s, it) => s + it.qty * it.price, 0);
  const netTotal = total - (inv.discount || 0);
  // نفس حسبة صفحة الفاتورة بالظبط — الشراء بنقلب إشارته عشان «الباقي له» يقرا موجب.
  const isSale = inv.kind === 'SALE';
  const sign = isSale ? 1 : -1;
  const remaining = sheet ? sign * sheet.remaining : null;
  const previousBalance = sheet ? sign * sheet.previousBalance : null;
  const cashTransfer = sheet ? sign * sheet.cashTransfer : 0;
  const sheetTotal = previousBalance !== null ? previousBalance + netTotal : null;
  const other = sheet && sheetTotal !== null && remaining !== null
    ? remaining - (sheetTotal + cashTransfer - sheet.paymentsTotal)
    : 0;

  return (
    <div className="pit-wrap">
      <div className="pit-bar" role="tablist">
        {tabs.map((t, i) => (
          <button
            key={`${t.inv.id}:${t.kind}`}
            role="tab"
            aria-selected={i === active}
            className={`pit-tab ${t.kind === 'receipts' ? 'is-receipts' : ''} ${i === active ? 'is-active' : ''}`}
            onClick={() => setActive(i)}
          >
            <span>{t.kind === 'invoice' ? `فاتورة ${t.inv.no}` : `استلامات ${t.inv.no}`}</span>
            <span className="pit-tab-date">{fmtDate(t.inv.date)}</span>
          </button>
        ))}
      </div>

      <div className={`pit-panel card ${cursor.kind === 'receipts' ? 'is-receipts' : ''}`}>
        {cursor.kind === 'invoice' ? (
          <>
            <div className="pit-head">
              <div>
                <b>فاتورة {inv.kind === 'SALE' ? 'بيع' : 'شراء'} رقم {inv.no}</b>
                <span className="muted" style={{ fontSize: 12, marginInlineStart: 8 }}>
                  {fmtDate(inv.date)}
                  {inv.warehouse?.name && <> · {inv.warehouse.name}</>}
                </span>
              </div>
              <div className="pit-head-end">
                <button className="btn btn-ghost btn-sm" onClick={() => onOpenInvoice(inv.id)}>فتح الفاتورة كاملة →</button>
              </div>
            </div>

            {/* نفس جسم ورقة الفاتورة بالحرف (المكوّن المشترك مع صفحة الفاتورة) */}
            <InvoiceSheetBody
              items={inv.items.map((it) => ({ name: it.product?.name ?? '—', qty: it.qty, price: it.price }))}
              cur={cur as 'EGP' | 'USD'}
              netTotal={netTotal}
              discount={inv.discount || 0}
              previousBalance={previousBalance}
              cashTransfer={cashTransfer}
              paymentsTotal={sheet ? sheet.paymentsTotal : null}
              other={other}
              remaining={remaining}
              isSale={isSale}
            />

            {/* عربيات الفاتورة دي — تاب لكل عربية بأصنافها ومصاريفها */}
            <ManifestTabs invoiceId={inv.id} />
          </>
        ) : inv.fake ? (
          <div className="empty">فاتورة وهمية — مالهاش حركات في الكشف</div>
        ) : loadingSheet ? (
          <Spinner />
        ) : (
          <InvoiceSheetPayments
            cur={cur as 'EGP' | 'USD'}
            payments={(sheet?.payments ?? []).map((p) => ({ id: p.id, date: p.date, note: p.note || p.type, amount: p.amount }))}
            total={sheet?.paymentsTotal ?? 0}
            title={<>
              استلامات {inv.no}
              <span className="muted">
                {' — '}من {fmtDate(inv.date)}{' '}
                {sheet?.nextInvoiceNo ? <>لحد فاتورة {sheet.nextInvoiceNo}</> : <>لحد دلوقتي</>}
              </span>
            </>}
          />
        )}
      </div>
    </div>
  );
}
