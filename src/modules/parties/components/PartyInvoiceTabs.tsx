'use client';

import { useState } from 'react';
import { money, fmtDate } from '@/lib/format';
import { Spinner } from '@/components/common';
import { useInvoices, useInvoiceSheet } from '../../invoices/hooks';
import { ManifestTabs } from '../../invoices/components/ManifestTabs';
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
                <span className="pill">الإجمالي {money(netTotal, cur)}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => onOpenInvoice(inv.id)}>فتح الفاتورة كاملة →</button>
              </div>
            </div>

            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>العدد</th>
                    <th>الصنف</th>
                    <th style={{ width: 110 }}>السعر</th>
                    <th style={{ width: 120 }}>الاجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((it, i) => (
                    <tr key={it.id ?? i}>
                      <td className="num">{it.qty}</td>
                      <td>{it.product?.name ?? '—'}</td>
                      <td className="num">{money(it.price, cur)}</td>
                      <td className="num">{money(it.qty * it.price, cur)}</td>
                    </tr>
                  ))}
                  <tr className="mf-total">
                    <td colSpan={3}>{(inv.discount || 0) > 0 ? 'إجمالي الأصناف بعد الخصم' : 'إجمالي الأصناف'}</td>
                    <td className="num">{money(netTotal, cur)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* عربيات الفاتورة دي — تاب لكل عربية بأصنافها ومصاريفها */}
            <ManifestTabs invoiceId={inv.id} />
          </>
        ) : (
          <>
            <div className="pit-head">
              <div>
                <b>استلامات {inv.no}</b>
                <span className="muted" style={{ fontSize: 12, marginInlineStart: 8 }}>
                  من {fmtDate(inv.date)}{' '}
                  {sheet?.nextInvoiceNo ? <>لحد فاتورة {sheet.nextInvoiceNo}</> : <>لحد دلوقتي</>}
                </span>
              </div>
              <div className="pit-head-end">
                <span className="pill">الإجمالي {money(sheet?.paymentsTotal ?? 0, cur)}</span>
              </div>
            </div>

            {inv.fake ? (
              <div className="empty">فاتورة وهمية — مالهاش حركات في الكشف</div>
            ) : loadingSheet ? (
              <Spinner />
            ) : (
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>التاريخ</th>
                      <th>البيان</th>
                      <th style={{ width: 130 }}>المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sheet?.payments ?? []).map((p) => (
                      <tr key={p.id}>
                        <td className="muted">{fmtDate(p.date)}</td>
                        <td>{p.note || p.type}</td>
                        <td className="num cre">{money(p.amount, cur)}</td>
                      </tr>
                    ))}
                    {(sheet?.payments?.length ?? 0) === 0 && (
                      <tr><td colSpan={3} className="empty">مفيش استلامات في الفترة دي</td></tr>
                    )}
                    <tr className="mf-total">
                      <td colSpan={2}>الاجمالي</td>
                      <td className="num">{money(sheet?.paymentsTotal ?? 0, cur)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
