'use client';

import { useState } from 'react';
import { money, fmtDate } from '@/lib/format';
import { Spinner } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useManifestTabs, useSetManifestTabClosed } from '../hooks';
import type { ManifestTab } from '../dtos';

/**
 * تابات العربيات جوّه الفاتورة — تاب لكل عربية، جوّاه أصنافها (بلون) ومصاريفها (بلون
 * تاني)، زي ما كان بيتعمل في الشيتات.
 *
 * توزيع المصاريف بتحسبه السيرفر: كل عربية بتاخد المصاريف من تاريخ العربية اللي قبلها
 * لحد تاريخها، وآخر عربية تابها مفتوح بياخد أي مصروف جديد لحد ما يتقفل.
 */
export function ManifestTabs({ invoiceId }: { invoiceId: string }) {
  const { can } = useAuth();
  const { data, isLoading } = useManifestTabs(invoiceId);
  const setClosed = useSetManifestTabClosed();
  const [active, setActive] = useState(0);
  const [err, setErr] = useState('');

  if (isLoading) return <Spinner />;
  // فاتورة من غير عربيات مالهاش تابات — مانعرضش شريط فاضي.
  if (!data || data.tabs.length === 0) return null;

  const tabs = data.tabs;
  const cur = data.currency;
  // لو اتقفل تاب واختفى/اتغيّر الترتيب، ما نطلعش برّه المصفوفة.
  const tab: ManifestTab = tabs[Math.min(active, tabs.length - 1)];
  const label = (t: ManifestTab) => t.vehicleLabel || `عربية رقم ${t.no}`;

  const toggleClosed = () => {
    setErr('');
    setClosed.mutate(
      { uid: tab.id, closed: !tab.closedAt },
      { onError: (e: any) => setErr(e.message) },
    );
  };

  return (
    <div className="mt-wrap no-print">
      <div className="mt-bar" role="tablist">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={i === active}
            className={`mt-tab ${i === active ? 'is-active' : ''} ${t.closedAt ? 'is-closed' : ''}`}
            onClick={() => { setActive(i); setErr(''); }}
          >
            {label(t)}
            {t.closedAt && <span className="mt-lock" title={`اتقفل ${fmtDate(t.closedAt)}${t.closedBy ? ` — ${t.closedBy}` : ''}`}>🔒</span>}
          </button>
        ))}
      </div>

      <div className="mt-panel card">
        <div className="mt-head">
          <div>
            <b>{label(tab)}</b>
            <span className="muted" style={{ fontSize: 12, marginInlineStart: 8 }}>
              {fmtDate(tab.date)}
              {tab.vehicleNo && <> · لوحة {tab.vehicleNo}</>}
              {tab.driverName && <> · {tab.driverName}</>}
            </span>
          </div>
          <div className="mt-head-end">
            <span className={`pill ${tab.closedAt ? 'mt-pill-closed' : 'mt-pill-open'}`}>
              {tab.closedAt
                ? `مقفول — ${fmtDate(tab.closedAt)}${tab.closedBy ? ` · ${tab.closedBy}` : ''}`
                : 'مفتوح — بياخد المصاريف الجديدة'}
            </span>
            {can('manifests.close') && (
              <button className="btn btn-ghost btn-sm" onClick={toggleClosed} disabled={setClosed.isPending}>
                {setClosed.isPending ? '...' : tab.closedAt ? 'فتح التاب' : 'قفل التاب'}
              </button>
            )}
          </div>
        </div>

        <div className="muted mt-window">
          مصاريف التاب: من {fmtDate(tab.from)} {tab.to ? <>إلى {fmtDate(tab.to)}</> : <b>لحد ما يتقفل</b>}
        </div>

        {err && <div className="err-text">{err}</div>}

        <div className="tbl-wrap">
          <table className="mt-tbl">
            <thead>
              <tr>
                <th style={{ width: 100 }}>العدد</th>
                <th>البيان</th>
                <th style={{ width: 110 }}>السعر</th>
                <th style={{ width: 130 }}>الاجمالي</th>
              </tr>
            </thead>
            <tbody>
              {/* أصناف العربية — لون البضاعة */}
              {tab.items.map((it) => (
                <tr key={it.id} className="mt-goods">
                  <td className="num">{it.qty}</td>
                  <td>{it.name}</td>
                  <td className="num">{it.price === null ? '—' : money(it.price, cur)}</td>
                  <td className="num">{it.total === null ? '—' : money(it.total, cur)}</td>
                </tr>
              ))}
              {tab.items.length === 0 && (
                <tr className="mt-goods"><td colSpan={4} className="empty">مفيش أصناف في كشف العربية</td></tr>
              )}
              <tr className="mt-sub mt-goods">
                <td colSpan={3}>إجمالي أصناف العربية</td>
                <td className="num">{money(tab.itemsTotal, cur)}</td>
              </tr>

              {/* المصاريف — لون مختلف */}
              {tab.expenses.map((e) => (
                <tr key={e.id} className="mt-exp">
                  <td className="muted" style={{ fontSize: 12 }}>{fmtDate(e.date)}</td>
                  <td>
                    {e.note || e.category || e.type}
                    {e.category && e.note && <span className="muted" style={{ fontSize: 11 }}> · {e.category}</span>}
                    {e.pinned && <span className="pill mt-pin" title="اتضاف من التاب ده">مثبّت</span>}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{e.treasury || ''}</td>
                  <td className="num">{money(e.amount, cur)}</td>
                </tr>
              ))}
              {tab.expenses.length === 0 && (
                <tr className="mt-exp"><td colSpan={4} className="empty">مفيش مصاريف في الفترة دي</td></tr>
              )}
              <tr className="mt-sub mt-exp">
                <td colSpan={3}>إجمالي المصاريف</td>
                <td className="num">{money(tab.expensesTotal, cur)}</td>
              </tr>

              <tr className="mf-total">
                <td colSpan={3}>إجمالي العربية</td>
                <td className="num">{money(tab.itemsTotal + tab.expensesTotal, cur)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
