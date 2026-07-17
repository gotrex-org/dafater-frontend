'use client';

import { useState, type ReactNode } from 'react';
import { EGP, QTY, fmtDate } from '@/lib/format';
import { PageTitle, Spinner, StatsGrid, StatCard, SegmentedControl, Combobox } from '@/components/common';
import { useReportSummary, useTopProducts, useTopClients, useTopSuppliers, useBusiest, useInactiveClients, useProfitLoss, useExpensesByCategory, useBusiestFor, useCustodyBalances } from '../hooks';
import { useAllParties } from '../../parties/hooks';
import { useAllProducts } from '../../products/hooks';

// أول الشهر الحالي — الفلتر بيفتح عليه افتراضيًا (تقارير شهرية).
function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const money = (n: number) => `${EGP(n)} ج.م`;

function Bar({ value, max, color = 'var(--accent)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return <div style={{ background: 'var(--line-soft)', borderRadius: 4, height: 8, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: color }} /></div>;
}

// عنوان + الرقم المهم (headline) دايمًا ظاهر، والتفاصيل تظهر/تختفي بالسهم.
function Collapsible({ title, headline, defaultOpen = false, children }: { title: string; headline?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
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

// بلوك صغير جوه Peak — عنوان + جدول توب-5.
function MiniTop({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

type R = { from?: string; to?: string };

// اختيار عميل/مورد/صنف وشوف أكتر فترة اشتغل فيها.
function PeakSelector({ r }: { r: R }) {
  const [type, setType] = useState<'client' | 'supplier' | 'product'>('client');
  const [id, setId] = useState('');
  const { data: clients } = useAllParties('CLIENT');
  const { data: suppliers } = useAllParties('SUPPLIER');
  const { data: products } = useAllProducts();
  const opts = type === 'client' ? (clients?.data ?? []) : type === 'supplier' ? (suppliers?.data ?? []) : (products?.data ?? []);
  const { data: bf } = useBusiestFor(type, id || null, r);
  const maxM = Math.max(1, ...(bf?.months ?? []).map((m) => m.total));
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--line-soft)' }}>
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>🔎 أكتر فترة اشتغل فيها…</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SegmentedControl value={type} onChange={(v) => { setType(v as any); setId(''); }} options={[{ value: 'client', label: 'عميل' }, { value: 'supplier', label: 'مورد' }, { value: 'product', label: 'صنف' }]} />
        <div style={{ minWidth: 220 }}>
          <Combobox options={opts} value={id} onChange={setId} placeholder="اختر…" />
        </div>
      </div>
      {id && bf && (
        bf.months.length === 0 ? <div className="empty">لا يوجد نشاط في الفترة</div> : (
          <div style={{ marginTop: 10 }}>
            {bf.peak && <div style={{ fontWeight: 700, marginBottom: 8 }}>أعلى شهر: <b>{bf.peak.month}</b> ({money(bf.peak.total)})</div>}
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>الشهر</th><th style={{ width: 160 }}></th><th style={{ width: 130 }}>القيمة</th></tr></thead>
                <tbody>{bf.months.map((m) => <tr key={m.month}><td className="num">{m.month}</td><td><Bar value={m.total} max={maxM} /></td><td className="num">{EGP(m.total)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}

export function ReportsView({ embedded = false }: { embedded?: boolean }) {
  const [from, setFrom] = useState(monthStart());
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
  const expenses = useExpensesByCategory(r);
  const custody = useCustodyBalances();

  const maxQty = Math.max(1, ...(products.data ?? []).map((p) => p.qty));
  const maxClient = Math.max(1, ...(clients.data ?? []).map((c) => c.total));
  const maxSupplier = Math.max(1, ...(suppliers.data ?? []).map((s) => s.total));
  const maxMonth = Math.max(1, ...(busiest.data?.months ?? []).map((m) => m.total));

  return (
    <>
      {!embedded && <PageTitle title="التقارير" subtitle="أهم الأرقام في عناوين — افتح أي تقرير بالسهم للتفاصيل" />}

      <div className="toolbar" style={{ flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 12 }}>من</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        <span className="muted" style={{ fontSize: 12 }}>إلى</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(monthStart()); setTo(''); }}>الشهر الحالي</button>
        {(from || to) && <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); }}>كل الفترة</button>}
      </div>

      {/* 1) مشتريات */}
      <Collapsible title="🛒 مشتريات" headline={summary.data && <span>{money(summary.data.purchases)}</span>}>
        {summary.isLoading || !summary.data ? <Spinner /> : (
          <StatsGrid columns={3}>
            <StatCard label="إجمالي المشتريات" value={money(summary.data.purchases)} />
            <StatCard label="مرتجعات الشراء" value={money(summary.data.purchaseReturns)} />
            <StatCard label="عدد فواتير الشراء" value={summary.data.purchasesCount} />
          </StatsGrid>
        )}
      </Collapsible>

      {/* 2) مبيعات */}
      <Collapsible title="💰 مبيعات" headline={summary.data && <span className="cre">{money(summary.data.sales)}</span>}>
        {summary.isLoading || !summary.data ? <Spinner /> : (
          <StatsGrid columns={3}>
            <StatCard variant="gold" label="إجمالي المبيعات" value={money(summary.data.sales)} />
            <StatCard label="مرتجعات البيع" value={money(summary.data.salesReturns)} />
            <StatCard label="عدد فواتير البيع" value={summary.data.salesCount} />
          </StatsGrid>
        )}
      </Collapsible>

      {/* 3) مصاريف — مجموعتين (مخزن/خارجية) وجوه كل واحدة بنودها */}
      <Collapsible title="🧾 مصاريف" headline={expenses.data && <span className="deb">{money(expenses.data.total)}</span>}>
        {expenses.isLoading ? <Spinner /> : !expenses.data || expenses.data.total === 0 ? <div className="empty">لا توجد مصاريف في الفترة</div> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {expenses.data.groups.map((grp) => {
              const gMax = Math.max(1, ...grp.items.map((x) => x.total));
              return (
                <div key={grp.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, marginBottom: 6 }}>
                    <span>{grp.key === 'WAREHOUSE' ? '🏬' : '🚚'} {grp.label}</span>
                    <span className="num deb">{money(grp.total)}</span>
                  </div>
                  {!grp.items.length ? <div className="muted" style={{ fontSize: 12.5, paddingInlineStart: 6 }}>لا يوجد</div> : (
                    <div className="tbl-wrap">
                      <table>
                        <thead><tr><th>البند</th><th style={{ width: 160 }}></th><th style={{ width: 130 }}>الإجمالي</th></tr></thead>
                        <tbody>
                          {grp.items.map((x) => (
                            <tr key={x.name}><td><b>{x.name}</b></td><td><Bar value={x.total} max={gMax} color="var(--debit)" /></td><td className="num deb">{EGP(x.total)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="num deb" style={{ textAlign: 'end', fontWeight: 800, borderTop: '1.5px solid var(--line)', paddingTop: 8 }}>الإجمالي: {money(expenses.data.total)}</div>
          </div>
        )}
      </Collapsible>

      {/* 4) إجمالي ربح وخسارة */}
      <Collapsible title="📈 إجمالي ربح وخسارة" defaultOpen headline={pl.data && <span className={pl.data.netProfit >= 0 ? 'cre' : 'deb'}>{money(pl.data.netProfit)}</span>}>
        {pl.isLoading || !pl.data ? <Spinner /> : (
          <StatsGrid columns={4}>
            <StatCard variant="gold" label="الإيرادات (صافي المبيعات)" value={money(pl.data.revenue)} />
            <StatCard label="التكلفة (مشتريات + مصاريف بضاعة)" value={money(pl.data.cost)} />
            <StatCard label="مجمل الربح" value={money(pl.data.grossProfit)} />
            <StatCard variant="debit" label="المصاريف التشغيلية" value={money(pl.data.expenses)} />
            <StatCard variant="debit" label="منها: مصاريف المخزن" value={money(pl.data.warehouseExpenses)} />
            <StatCard variant="debit" label="تسويات نقدية" value={money(pl.data.settlement)} />
            <StatCard variant={pl.data.netProfit >= 0 ? 'accent' : 'debit'} label="صافي الربح" value={money(pl.data.netProfit)} />
          </StatsGrid>
        )}
      </Collapsible>

      {/* العُهَد */}
      <Collapsible title="🤝 العُهَد (فلوس مع الناس أمانة/سلف)" headline={custody.data && <span className="deb">{money(custody.data.total)}</span>}>
        {custody.isLoading ? <Spinner /> : !custody.data?.holders.length ? <div className="empty">لا توجد عُهَد مفتوحة</div> : (
          <div className="tbl-wrap"><table>
            <thead><tr><th style={{ width: 32 }}>#</th><th>صاحب العهدة</th><th style={{ width: 140 }}>المبلغ اللي عليه</th></tr></thead>
            <tbody>{custody.data.holders.map((h, i) => (
              <tr key={h.id}><td className="muted">{i + 1}</td><td><b>{h.name}</b></td><td className="num deb">{EGP(h.balance)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Collapsible>

      {/* 5) Peak */}
      <Collapsible title="⭐ Peak — أكتر صنف/عميل/مورد ووقت شغل">
        <div style={{ marginTop: 4 }}><PeakSelector r={r} /></div>

        <MiniTop title="🏆 أكتر صنف شغّال (بيعًا)">
          {products.isLoading ? <Spinner /> : !products.data?.length ? <div className="empty">لا يوجد</div> : (
            <div className="tbl-wrap"><table>
              <thead><tr><th style={{ width: 32 }}>#</th><th>الصنف</th><th style={{ width: 110 }}>الكمية</th><th style={{ width: 140 }}></th><th style={{ width: 120 }}>الإيرادات</th></tr></thead>
              <tbody>{products.data.slice(0, 5).map((p, i) => (
                <tr key={p.id}><td className="muted">{i + 1}</td><td><b>{p.name}</b></td><td className="num">{QTY(p.qty)} {p.unit || ''}</td><td><Bar value={p.qty} max={maxQty} /></td><td className="num">{EGP(p.revenue)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </MiniTop>

        <MiniTop title="👤 أكتر عميل شغّال">
          {clients.isLoading ? <Spinner /> : !clients.data?.length ? <div className="empty">لا يوجد</div> : (
            <div className="tbl-wrap"><table>
              <thead><tr><th style={{ width: 32 }}>#</th><th>العميل</th><th style={{ width: 140 }}></th><th style={{ width: 120 }}>الإجمالي</th></tr></thead>
              <tbody>{clients.data.slice(0, 5).map((c, i) => (
                <tr key={c.id}><td className="muted">{i + 1}</td><td><b>{c.name}</b></td><td><Bar value={c.total} max={maxClient} color="var(--gold)" /></td><td className="num">{EGP(c.total)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </MiniTop>

        <MiniTop title="🏭 أكتر مورد شغّال">
          {suppliers.isLoading ? <Spinner /> : !suppliers.data?.length ? <div className="empty">لا يوجد</div> : (
            <div className="tbl-wrap"><table>
              <thead><tr><th style={{ width: 32 }}>#</th><th>المورد</th><th style={{ width: 140 }}></th><th style={{ width: 120 }}>الإجمالي</th></tr></thead>
              <tbody>{suppliers.data.slice(0, 5).map((s, i) => (
                <tr key={s.id}><td className="muted">{i + 1}</td><td><b>{s.name}</b></td><td><Bar value={s.total} max={maxSupplier} color="var(--debit)" /></td><td className="num">{EGP(s.total)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </MiniTop>

        <MiniTop title="⏱ أكتر وقت اشتغل فيه المخزن">
          {busiest.isLoading || !busiest.data ? <Spinner /> : (
            <>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                {busiest.data.peakMonth && <span className="pill" style={{ fontSize: 13 }}>أعلى شهر: <b>{busiest.data.peakMonth.month}</b> ({EGP(busiest.data.peakMonth.total)} ج.م)</span>}
                {busiest.data.peakDay && <span className="pill" style={{ fontSize: 13 }}>أعلى يوم: <b>{busiest.data.peakDay.day}</b> ({EGP(busiest.data.peakDay.total)} ج.م)</span>}
              </div>
              <div className="tbl-wrap"><table>
                <thead><tr><th>الشهر</th><th style={{ width: 160 }}></th><th style={{ width: 120 }}>المبيعات</th></tr></thead>
                <tbody>
                  {busiest.data.months.map((m) => (<tr key={m.month}><td className="num">{m.month}</td><td><Bar value={m.total} max={maxMonth} /></td><td className="num">{EGP(m.total)}</td></tr>))}
                  {!busiest.data.months.length && <tr><td colSpan={3} className="empty">لا يوجد</td></tr>}
                </tbody>
              </table></div>
            </>
          )}
        </MiniTop>
      </Collapsible>

      {/* عملاء متوقفين */}
      <Collapsible title="😴 عملاء بقالهم فترة ما اشتغلوش" headline={inactive.data && <span className="deb">{inactive.data.length} عميل</span>}>
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
          <div className="tbl-wrap"><table>
            <thead><tr><th style={{ width: 32 }}>#</th><th>العميل</th><th style={{ width: 140 }}>آخر حركة</th><th style={{ width: 120 }}>من كام يوم</th></tr></thead>
            <tbody>{inactive.data.map((c, i) => (
              <tr key={c.id}><td className="muted">{i + 1}</td><td><b>{c.name}</b></td><td>{c.lastActivity ? fmtDate(c.lastActivity) : '—'}</td><td className="num deb">{c.daysSince} يوم</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Collapsible>
    </>
  );
}
