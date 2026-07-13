'use client';

import { useState } from 'react';
import { EGP, QTY, fmtDate } from '@/lib/format';
import { PageTitle, Spinner, StatsGrid, StatCard } from '@/components/common';
import { useReportSummary, useTopProducts, useTopClients, useTopSuppliers, useBusiest, useInactiveClients, useProfitLoss } from '../hooks';
import { FinancePanel } from '../../finance/components/FinancePanel';

// A thin proportional bar for quick visual comparison inside a table cell.
function Bar({ value, max, color = 'var(--accent)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return <div style={{ background: 'var(--line-soft)', borderRadius: 4, height: 8, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: color }} /></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 16, marginTop: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export function ReportsView({ embedded = false }: { embedded?: boolean }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [inactiveDays, setInactiveDays] = useState(45);
  const r = { from: from || undefined, to: to || undefined };

  const summary = useReportSummary(r);
  const products = useTopProducts(r);
  const clients = useTopClients(r);
  const suppliers = useTopSuppliers(r);
  const busiest = useBusiest(r);
  const inactive = useInactiveClients(inactiveDays);
  const pl = useProfitLoss(r);

  const maxQty = Math.max(1, ...(products.data ?? []).map((p) => p.qty));
  const maxClient = Math.max(1, ...(clients.data ?? []).map((c) => c.total));
  const maxSupplier = Math.max(1, ...(suppliers.data ?? []).map((s) => s.total));
  const maxMonth = Math.max(1, ...(busiest.data?.months ?? []).map((m) => m.total));
  const maxDow = Math.max(1, ...(busiest.data?.weekdays ?? []).map((d) => d.total));

  return (
    <>
      {!embedded && <PageTitle title="التقارير" subtitle="أكتر صنف وأكتر عميل وأكتر وقت شغل — وملخّص كامل لنشاطك" />}

      <div className="toolbar" style={{ flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 12 }}>من</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        <span className="muted" style={{ fontSize: 12 }}>إلى</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        {(from || to) && <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); }}>كل الفترة</button>}
      </div>

      {/* Summary */}
      {summary.isLoading || !summary.data ? <Spinner /> : (
        <StatsGrid columns={4}>
          <StatCard variant="gold" label="المبيعات" value={`${EGP(summary.data.sales)} ج.م`} />
          <StatCard label="المشتريات" value={`${EGP(summary.data.purchases)} ج.م`} />
          <StatCard label="صافي المبيعات (بعد المرتجعات)" value={`${EGP(summary.data.netSales)} ج.م`} />
          <StatCard label="مجمل الربح التقديري" value={`${EGP(summary.data.grossProfit)} ج.م`} />
          <StatCard label="عدد فواتير البيع" value={summary.data.salesCount} />
          <StatCard label="عدد فواتير الشراء" value={summary.data.purchasesCount} />
          <StatCard label="مرتجعات البيع" value={`${EGP(summary.data.salesReturns)} ج.م`} />
          <StatCard label="مرتجعات الشراء" value={`${EGP(summary.data.purchaseReturns)} ج.م`} />
        </StatsGrid>
      )}

      {/* Profit & loss */}
      <Section title="📈 ربح وخسارة">
        {pl.isLoading || !pl.data ? <Spinner /> : (
          <StatsGrid columns={5}>
            <StatCard variant="gold" label="الإيرادات (صافي المبيعات)" value={`${EGP(pl.data.revenue)} ج.م`} />
            <StatCard label="التكلفة (صافي المشتريات)" value={`${EGP(pl.data.cost)} ج.م`} />
            <StatCard label="مجمل الربح" value={`${EGP(pl.data.grossProfit)} ج.م`} />
            <StatCard variant="debit" label="المصاريف التشغيلية" value={`${EGP(pl.data.expenses)} ج.م`} />
            <StatCard variant={pl.data.netProfit >= 0 ? 'accent' : 'debit'} label="صافي الربح" value={`${EGP(pl.data.netProfit)} ج.م`} />
          </StatsGrid>
        )}
      </Section>

      {/* Owner-private personal finance */}
      <Section title="💼 حساباتي الشخصية — مصاريف ودفعات شهرية (خاص بيك أنت بس)">
        <FinancePanel from={from || undefined} to={to || undefined} />
      </Section>

      {/* Top products */}
      <Section title="🏆 أكتر صنف شغّال (بيعًا)">
        {products.isLoading ? <Spinner /> : !products.data?.length ? <div className="empty">لا توجد مبيعات</div> : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th style={{ width: 32 }}>#</th><th>الصنف</th><th style={{ width: 120 }}>الكمية المباعة</th><th style={{ width: 160 }}></th><th style={{ width: 130 }}>الإيرادات</th></tr></thead>
              <tbody>
                {products.data.map((p, i) => (
                  <tr key={p.id}><td className="muted">{i + 1}</td><td><b>{p.name}</b></td><td className="num">{QTY(p.qty)} {p.unit || ''}</td><td><Bar value={p.qty} max={maxQty} /></td><td className="num">{EGP(p.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Top clients */}
      <Section title="👤 أكتر عميل شغّال">
        {clients.isLoading ? <Spinner /> : !clients.data?.length ? <div className="empty">لا يوجد</div> : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th style={{ width: 32 }}>#</th><th>العميل</th><th style={{ width: 90 }}>الفواتير</th><th style={{ width: 160 }}></th><th style={{ width: 130 }}>الإجمالي</th></tr></thead>
              <tbody>
                {clients.data.map((c, i) => (
                  <tr key={c.id}><td className="muted">{i + 1}</td><td><b>{c.name}</b></td><td className="num">{c.count}</td><td><Bar value={c.total} max={maxClient} color="var(--gold)" /></td><td className="num">{EGP(c.total)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Top suppliers */}
      <Section title="🏭 أكتر مورد شغّال">
        {suppliers.isLoading ? <Spinner /> : !suppliers.data?.length ? <div className="empty">لا يوجد</div> : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th style={{ width: 32 }}>#</th><th>المورد</th><th style={{ width: 90 }}>الفواتير</th><th style={{ width: 160 }}></th><th style={{ width: 130 }}>الإجمالي</th></tr></thead>
              <tbody>
                {suppliers.data.map((s, i) => (
                  <tr key={s.id}><td className="muted">{i + 1}</td><td><b>{s.name}</b></td><td className="num">{s.count}</td><td><Bar value={s.total} max={maxSupplier} color="var(--debit)" /></td><td className="num">{EGP(s.total)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Inactive clients */}
      <Section title="😴 عملاء بقالهم فترة ما اشتغلوش">
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>مامعملوش حركة من أكتر من</span>
          <select value={inactiveDays} onChange={(e) => setInactiveDays(Number(e.target.value))} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }}>
            <option value={30}>30 يوم</option>
            <option value={45}>45 يوم</option>
            <option value={60}>60 يوم</option>
            <option value={90}>90 يوم</option>
            <option value={180}>180 يوم</option>
          </select>
        </div>
        {inactive.isLoading ? <Spinner /> : !inactive.data?.length ? <div className="empty">كل العملاء نشطين 👍</div> : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th style={{ width: 32 }}>#</th><th>العميل</th><th style={{ width: 140 }}>آخر حركة</th><th style={{ width: 120 }}>من كام يوم</th></tr></thead>
              <tbody>
                {inactive.data.map((c, i) => (
                  <tr key={c.id}><td className="muted">{i + 1}</td><td><b>{c.name}</b></td><td>{c.lastActivity ? fmtDate(c.lastActivity) : '—'}</td><td className="num deb">{c.daysSince} يوم</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Busiest period */}
      <Section title="⏱ أكتر وقت اشتغل فيه المخزن">
        {busiest.isLoading || !busiest.data ? <Spinner /> : (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              {busiest.data.peakMonth && <span className="pill" style={{ fontSize: 13 }}>أعلى شهر: <b>{busiest.data.peakMonth.month}</b> ({EGP(busiest.data.peakMonth.total)} ج.م)</span>}
              {busiest.data.peakDay && <span className="pill" style={{ fontSize: 13 }}>أعلى يوم: <b>{busiest.data.peakDay.day}</b> ({EGP(busiest.data.peakDay.total)} ج.م)</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>الشهر</th><th style={{ width: 140 }}></th><th style={{ width: 120 }}>المبيعات</th></tr></thead>
                  <tbody>
                    {busiest.data.months.map((m) => (
                      <tr key={m.month}><td className="num">{m.month}</td><td><Bar value={m.total} max={maxMonth} /></td><td className="num">{EGP(m.total)}</td></tr>
                    ))}
                    {!busiest.data.months.length && <tr><td colSpan={3} className="empty">لا يوجد</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>اليوم</th><th style={{ width: 140 }}></th><th style={{ width: 120 }}>المبيعات</th></tr></thead>
                  <tbody>
                    {busiest.data.weekdays.map((d) => (
                      <tr key={d.day}><td>{d.day}</td><td><Bar value={d.total} max={maxDow} color="var(--gold)" /></td><td className="num">{EGP(d.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </Section>
    </>
  );
}
