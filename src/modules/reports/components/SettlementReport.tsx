'use client';

import { useState } from 'react';
import { EGP } from '@/lib/format';
import { Spinner } from '@/components/common';
import { useSettlementReport } from '../../settlement/hooks';

const money = (n: number) => `${EGP(n)} ج.م`;

/**
 * تقرير التصفيات: كل اسم برأس ماله ومستحقه وما سحبه ورصيده — نفس أرقام كشف حسابه.
 *   ثابتة: الرصيد = رأس المال + المستحق − المسحوب (وهو رصيده في ميزان المراجعة)
 *   برأس المال: الرصيد = المستحق − المدفوع (رأس المال أساس النسبة فقط)
 * التقرير كله وليس لفترة، لأن الرصيد تراكمي.
 */
export function SettlementReportSection() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useSettlementReport();

  return (
    <div className="card" style={{ padding: 0, marginTop: 10, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'start' }}
      >
        <span style={{ display: 'inline-block', transition: 'transform .15s', transform: open ? 'rotate(90deg)' : 'none', color: 'var(--ink-soft)', fontSize: 13 }}>▶</span>
        <span style={{ fontWeight: 800, flex: 1 }}>🧾 التصفيات</span>
        {data && <span style={{ fontWeight: 800, fontSize: 14 }} className="cre">{money(data.totals.balance)}</span>}
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {isLoading || !data ? <Spinner /> : !data.rows.length ? <div className="empty">لا توجد أسماء في التصفية</div> : (
            <>
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>الاسم</th>
                      <th>الطريقة</th>
                      <th className="num">رأس المال</th>
                      <th className="num">المستحق (المكسب)</th>
                      <th className="num">المسحوب</th>
                      <th className="num">الرصيد له</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.id} style={!r.active ? { opacity: 0.6 } : undefined}>
                        <td><b>{r.name}</b></td>
                        <td className="muted">{r.shareBasis === 'FIXED' ? 'تصفية ثابتة' : 'برأس المال'}</td>
                        <td className="num">{EGP(r.capital)}</td>
                        <td className="num cre">{EGP(r.dues)}</td>
                        <td className="num deb">{EGP(r.paid)}</td>
                        <td className={`num ${r.balance < 0 ? 'deb' : ''}`}><b>{EGP(r.balance)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={2}>الإجمالي</th>
                      <th className="num">{EGP(data.totals.capital)}</th>
                      <th className="num">{EGP(data.totals.dues)}</th>
                      <th className="num">{EGP(data.totals.paid)}</th>
                      <th className="num">{EGP(data.totals.balance)}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                التصفية الثابتة: الرصيد = رأس المال + المستحق − المسحوب، وهو رصيده في ميزان المراجعة.
                برأس المال: الرصيد = المستحق − المدفوع، ورأس المال أساس النسبة فقط.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
