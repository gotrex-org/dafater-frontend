'use client';

import { useState, type ReactNode } from 'react';
import { EGP, QTY, fmtDate } from '@/lib/format';
import { Spinner, StatsGrid, StatCard } from '@/components/common';
import { useShippingSummary, useTradeReport, useVehicleProfits } from '../hooks';
import { ManifestPrint } from '../../manifests/components/ManifestPrint';

type R = { from?: string; to?: string };

const money = (n: number) => `${EGP(n)} ج.م`;

function Section({ title, headline, defaultOpen = false, children }: { title: string; headline?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card" style={{ padding: 0, marginTop: 10, overflow: 'hidden' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'start' }}>
        <span style={{ display: 'inline-block', transition: 'transform .15s', transform: open ? 'rotate(90deg)' : 'none', color: 'var(--ink-soft)', fontSize: 13 }}>▶</span>
        <span style={{ fontWeight: 800, flex: 1 }}>{title}</span>
        {headline != null && <span style={{ fontWeight: 800, fontSize: 14 }}>{headline}</span>}
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  );
}

const signed = (n: number) => <span className={n >= 0 ? 'cre' : 'deb'}>{money(n)}</span>;

/** تقرير التجارة: مبيعات الأصناف، تكلفتها، ربح التجارة، المخزون. */
export function TradeReportSection({ r }: { r: R }) {
  const { data, isLoading } = useTradeReport(r);
  return (
    <Section title="🏪 تقرير التجارة" defaultOpen headline={data && signed(data.netProfit)}>
      {isLoading || !data ? <Spinner /> : (
        <>
          <StatsGrid columns={4}>
            <StatCard variant="gold" label="مبيعات الأصناف (صافي)" value={money(data.netSales)} />
            <StatCard label="تكلفة الأصناف المباعة" value={money(data.cost)} />
            <StatCard variant={data.grossProfit >= 0 ? 'accent' : 'debit'} label="مجمل ربح التجارة" value={money(data.grossProfit)} />
            <StatCard variant={data.netProfit >= 0 ? 'accent' : 'debit'} label="صافي ربح التجارة" value={money(data.netProfit)} />
          </StatsGrid>
          <div className="tbl-wrap" style={{ marginTop: 10 }}>
            <table>
              <tbody>
                <tr><td>مبيعات الأصناف</td><td className="num">{EGP(data.sales)}</td></tr>
                {data.salesDiscount > 0 && <tr><td>خصومات على الفواتير</td><td className="num deb">− {EGP(data.salesDiscount)}</td></tr>}
                {data.salesReturns > 0 && <tr><td>مرتجعات بيع</td><td className="num deb">− {EGP(data.salesReturns)}</td></tr>}
                <tr><td><b>صافي المبيعات</b></td><td className="num"><b>{EGP(data.netSales)}</b></td></tr>
                <tr><td>تكلفة الأصناف المباعة <span className="muted">(متوسط سعر الشراء شامل الناولون الداخلي والشاي)</span></td><td className="num deb">− {EGP(data.cost)}</td></tr>
                <tr><td><b>مجمل ربح التجارة</b></td><td className="num"><b>{EGP(data.grossProfit)}</b></td></tr>
                {data.expensesByCategory.map((e) => (
                  <tr key={e.name}><td>مصروف تجارة: {e.name}</td><td className="num deb">− {EGP(e.total)}</td></tr>
                ))}
                <tr className="mf-total"><td><b>صافي ربح التجارة</b></td><td className="num"><b>{EGP(data.netProfit)}</b></td></tr>
              </tbody>
            </table>
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
            {data.salesCount} فاتورة بيع · مشتريات الفترة {money(data.purchases)} · المرتبات محسوب منها نصيب التجارة فقط
          </div>

          {!!data.products.length && (
            <>
              <div style={{ fontWeight: 700, fontSize: 13, margin: '14px 0 6px' }}>ربح كل صنف</div>
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>الصنف</th><th className="num">الكمية</th><th className="num">المبيعات</th><th className="num">التكلفة</th><th className="num">الربح</th></tr></thead>
                  <tbody>
                    {data.products.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td className="num">{QTY(p.qty)} {p.unit ?? ''}</td>
                        <td className="num">{EGP(p.sales)}</td>
                        <td className="num">{EGP(p.cost)}</td>
                        <td className={`num ${p.profit >= 0 ? 'cre' : 'deb'}`}>{EGP(p.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div style={{ fontWeight: 700, fontSize: 13, margin: '14px 0 6px' }}>
            المخزون الحالي: {money(data.inventory.total)} <span className="muted" style={{ fontWeight: 400 }}>(لا يتأثر بفلتر الفترة)</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {data.inventory.warehouses.map((w) => (
              <span key={w.id} className="pill">{w.name}: <b className="num">{EGP(w.value)}</b></span>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

/** تقرير الشحن: إيرادات البنود، تكاليف العربيات، مصاريف المخزن، ربح الشحن. */
export function ShippingReportSection({ r }: { r: R }) {
  const { data, isLoading } = useShippingSummary(r);
  return (
    <Section title="🚚 تقرير الشحن" defaultOpen headline={data && signed(data.profit)}>
      {isLoading || !data ? <Spinner /> : (
        <>
          <StatsGrid columns={4}>
            <StatCard variant="gold" label="إيرادات الشحن" value={money(data.incomeTotal)} />
            <StatCard variant="debit" label="تكاليف العربيات" value={money(data.vehicleCostsTotal)} />
            <StatCard variant="debit" label="مصاريف المخزن" value={money(data.warehouseTotal)} />
            <StatCard variant={data.profit >= 0 ? 'accent' : 'debit'} label="ربح الشحن" value={money(data.profit)} />
          </StatsGrid>
          <div className="tbl-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead><tr><th>البند</th><th className="num" style={{ width: 140 }}>إيراد</th><th className="num" style={{ width: 140 }}>تكلفة</th></tr></thead>
              <tbody>
                <tr><td colSpan={3} style={{ fontWeight: 800 }}>إيرادات البنود</td></tr>
                {data.income.charges.map((c) => <tr key={`i-${c.name}`}><td>{c.name}</td><td className="num cre">{EGP(c.total)}</td><td /></tr>)}
                {!data.income.charges.length && <tr><td className="muted">لا توجد بنود شحن في الفترة</td><td /><td /></tr>}
                {data.income.truckDelay > 0 && <tr><td>عطلة العربيات على العملاء</td><td className="num cre">{EGP(data.income.truckDelay)}</td><td /></tr>}
                {data.income.truckWeightDiff > 0 && <tr><td>فرق الوزن على العملاء</td><td className="num cre">{EGP(data.income.truckWeightDiff)}</td><td /></tr>}

                <tr><td colSpan={3} style={{ fontWeight: 800 }}>تكاليف العربيات</td></tr>
                <tr><td>الإيجار (كشف السائقين) <span className="muted">— {data.trips} رحلة</span></td><td /><td className="num deb">{EGP(data.vehicleCosts.rent)}</td></tr>
                <tr><td>الجمرك والتخليص</td><td /><td className="num deb">{EGP(data.vehicleCosts.customs)}</td></tr>
                {data.vehicleCosts.loading.map((c) => <tr key={`l-${c.name}`}><td>{c.name}</td><td /><td className="num deb">{EGP(c.total)}</td></tr>)}
                {!data.vehicleCosts.loading.length && <tr><td>التحميل والشفتنة</td><td /><td className="num deb">{EGP(0)}</td></tr>}
                {data.vehicleCosts.driverExtras > 0 && <tr><td>عطلة وفرق وزن وشاي السائقين</td><td /><td className="num deb">{EGP(data.vehicleCosts.driverExtras)}</td></tr>}
                {data.vehicleCosts.invoiceFreight !== 0 && <tr><td>الناولون <span className="muted">(فواتير بيع مربوطة بعربية)</span></td><td /><td className="num deb">{EGP(data.vehicleCosts.invoiceFreight)}</td></tr>}
                {data.vehicleCosts.purchaseCharges.map((c) => <tr key={`p-${c.name}`}><td>{c.name} <span className="muted">(على فواتير الشراء)</span></td><td /><td className="num deb">{EGP(c.total)}</td></tr>)}

                <tr><td colSpan={3} style={{ fontWeight: 800 }}>مصاريف المخزن</td></tr>
                {data.warehouseExpenses.map((c) => <tr key={`w-${c.name}`}><td>{c.name}</td><td /><td className="num deb">{EGP(c.total)}</td></tr>)}
                {!data.warehouseExpenses.length && <tr><td className="muted">لا توجد مصاريف مخزن في الفترة</td><td /><td /></tr>}

                <tr className="mf-total">
                  <td><b>ربح الشحن</b></td>
                  <td className="num cre"><b>{EGP(data.incomeTotal)}</b></td>
                  <td className="num deb"><b>{EGP(data.vehicleCostsTotal + data.warehouseTotal)}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
            المرتبات محسوب منها نصيب الشحن فقط (النسبة من الإعدادات).
          </div>
        </>
      )}
    </Section>
  );
}

/** ربح كل عربية لوحدها (بتاريخ الكشف). */
export function VehicleProfitsSection({ r }: { r: R }) {
  const { data, isLoading } = useVehicleProfits(r);
  const [openId, setOpenId] = useState<string | null>(null);
  if (openId) return <div style={{ marginTop: 10 }}><ManifestPrint id={openId} onClose={() => setOpenId(null)} /></div>;
  return (
    <Section title="🚛 ربح كل عربية" headline={data && signed(data.totals.profit)}>
      {isLoading || !data ? <Spinner /> : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>الكشف</th><th>التاريخ</th><th>رقم الرأس / المقطورة</th><th>العميل</th>
                <th className="num">بنود الشحن</th><th className="num">الإيجار</th><th className="num">الجمرك والتخليص</th>
                <th className="num">تحميل وشفتنة</th><th className="num">ناولون</th><th className="num">الربح</th>
              </tr>
            </thead>
            <tbody>
              {data.vehicles.map((v) => (
                <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(v.id)}>
                  <td><b>{v.no}</b>{v.vehicleLabel ? <span className="muted"> · {v.vehicleLabel}</span> : null}</td>
                  <td className="muted">{fmtDate(v.date)}</td>
                  <td className="num">{[v.vehicleNo, v.trailerNo].filter(Boolean).join(' / ') || '—'}</td>
                  <td>{v.clientName}</td>
                  <td className="num">
                    {EGP(v.revenue)}
                    {v.unassigned > 0 && <div className="muted" style={{ fontSize: 11 }} title="بنود على الفاتورة غير مربوطة بعربية">+ {EGP(v.unassigned)} غير مربوطة</div>}
                  </td>
                  <td className="num">{EGP(v.rent)}</td>
                  <td className="num">{EGP(v.customs)}</td>
                  <td className="num">{EGP(v.loading)}</td>
                  <td className="num">{EGP(v.freight)}</td>
                  <td className={`num ${v.profit >= 0 ? 'cre' : 'deb'}`}><b>{EGP(v.profit)}</b></td>
                </tr>
              ))}
              {!data.vehicles.length && <tr><td colSpan={10} className="empty">لا توجد عربيات في الفترة</td></tr>}
              {!!data.vehicles.length && (
                <tr className="mf-total">
                  <td colSpan={4}><b>الإجمالي ({data.vehicles.length} عربية)</b></td>
                  <td className="num"><b>{EGP(data.totals.revenue)}</b></td>
                  <td className="num"><b>{EGP(data.totals.rent)}</b></td>
                  <td className="num"><b>{EGP(data.totals.customs)}</b></td>
                  <td className="num"><b>{EGP(data.totals.loading)}</b></td>
                  <td className="num"><b>{EGP(data.totals.freight)}</b></td>
                  <td className="num"><b>{EGP(data.totals.profit)}</b></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
