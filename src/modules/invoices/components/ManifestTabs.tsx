'use client';

import { useState } from 'react';
import { money, fmtDate } from '@/lib/format';
import { Spinner } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useManifestTabs, useSetManifestTabClosed } from '../hooks';
import type { ManifestTab } from '../dtos';

const DOTS = '..........................';

// نفس ألوان قايمة كشوفات العربيات — وصلت (أحمر) / في الطريق (أخضر).
const STATUS_LABEL: Record<ManifestTab['status'], string> = {
  arrived: 'وصلت ✓',
  pending: 'في الطريق',
  none: 'مافيش رحلة متسجّلة',
};

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="mf-info">
      <span className="mf-info-l">{label}</span>
      <span className="mf-info-v">{value || '—'}</span>
    </div>
  );
}

/**
 * تابات العربيات جوّه الفاتورة — تاب لكل عربية، وجوّاه **نفس شكل كشف العربية
 * المطبوع بالظبط** (نفس ترويسة أبو شامة وخانات السائق والعربية وجدول الأصناف
 * والإقرار)، وتحته المصاريف بلون مختلف زي تلوين الشيتات.
 *
 * لون التاب والكشف بيتبع حالة الرحلة: وصلت / في الطريق.
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
  const tab: ManifestTab = tabs[Math.min(active, tabs.length - 1)];
  const label = (t: ManifestTab) => t.vehicleLabel || `عربية رقم ${t.no}`;
  const totalQty = tab.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);

  const toggleClosed = () => {
    setErr('');
    setClosed.mutate({ uid: tab.id, closed: !tab.closedAt }, { onError: (e: any) => setErr(e.message) });
  };

  return (
    <div className="mt-wrap no-print">
      <div className="mt-bar" role="tablist">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={i === active}
            className={`mt-tab st-${t.status} ${i === active ? 'is-active' : ''} ${t.closedAt ? 'is-closed' : ''}`}
            onClick={() => { setActive(i); setErr(''); }}
          >
            <span className="mt-dot" aria-hidden />
            {label(t)}
            {t.closedAt && <span className="mt-lock" title={`اتقفل ${fmtDate(t.closedAt)}${t.closedBy ? ` — ${t.closedBy}` : ''}`}>🔒</span>}
          </button>
        ))}
      </div>

      <div className={`mt-panel card st-${tab.status}`}>
        <div className="mt-head">
          <span className={`pill mt-status st-${tab.status}`}>{STATUS_LABEL[tab.status]}</span>
          <div className="mt-head-end">
            <span className={`pill ${tab.closedAt ? 'mt-pill-closed' : 'mt-pill-open'}`}>
              {tab.closedAt
                ? `التاب مقفول — ${fmtDate(tab.closedAt)}${tab.closedBy ? ` · ${tab.closedBy}` : ''}`
                : 'التاب مفتوح — بياخد المصاريف الجديدة'}
            </span>
            {can('manifests.close') && (
              <button className="btn btn-ghost btn-sm" onClick={toggleClosed} disabled={setClosed.isPending}>
                {setClosed.isPending ? '...' : tab.closedAt ? 'فتح التاب' : 'قفل التاب'}
              </button>
            )}
          </div>
        </div>

        {err && <div className="err-text">{err}</div>}

        {/* ── نفس شكل كشف العربية المطبوع ── */}
        <div className="card print-sheet mf-sheet">
          <div className="mf-logo">أبو شامة</div>
          <div className="mf-head">
            <h2>كشف استلام بضاعة</h2>
            <div className="mf-meta">
              <span>رقم: <b>{tab.no}</b></span>
              <span>التاريخ: <b>{fmtDate(tab.date)}</b></span>
            </div>
          </div>

          <div className="mf-grid">
            <Info label="اسم العميل" value={tab.clientName} />
            <Info label="اسم السائق" value={tab.driverName} />
            <Info label="الرقم القومي للسائق" value={tab.driverNID} />
            <Info label="رقم تليفون السائق" value={tab.driverPhone} />
            <Info label="مسمّى العربية" value={tab.vehicleLabel} />
            <Info label="رقم العربية" value={tab.vehicleNo} />
            <Info label="رقم المقطورة" value={tab.trailerNo} />
          </div>

          <div className="tbl-wrap mf-grow">
            <table className="mt-tbl">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>الكمية</th>
                  <th>الصنف</th>
                  <th style={{ width: 110 }}>السعر</th>
                  <th style={{ width: 130 }}>الاجمالي</th>
                </tr>
              </thead>
              <tbody>
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
                  <td className="num"><b>{totalQty}</b></td>
                  <td><b>إجمالي العدد</b></td>
                  <td />
                  <td className="num">{money(tab.itemsTotal, cur)}</td>
                </tr>

                {/* المصاريف — لون مختلف عن البضاعة */}
                <tr className="mt-split"><td colSpan={4}>مصاريف العربية</td></tr>
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

          {tab.note && <p className="mf-note">ملاحظات: {tab.note}</p>}

          <div className="muted mt-window">
            مصاريف التاب: من {fmtDate(tab.from)} {tab.to ? <>إلى {fmtDate(tab.to)}</> : <b>لحد ما يتقفل</b>}
          </div>

          <div className="mf-ack">
            <p>
              أقر أنا / <b>{DOTS}</b> باستلام البضاعة المذكورة أعلاه،
              وأتعهد بالحفاظ على البضاعة المستلمة في حالتها الجيدة، والالتزام بتوصيلها إلى
              الجهة المحددة، كما أتعهد برد قيمة أي عجز أو تلف أو فقد يحدث بها لأي سبب يرجع لي.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
