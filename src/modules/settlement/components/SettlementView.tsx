'use client';

import { useEffect, useState } from 'react';
import { EGP, QTY, fmtDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import {
  EmptyState, PageTitle, SegmentedControl, Spinner, StatCard, StatsGrid,
} from '@/components/common';
import { usePartners, useSettlementOverview } from '../hooks';
import type { CapitalTotals, Partner, SupplierAccount, Vehicle } from '../dtos';
import { VehicleDetailModal } from './VehicleDetail';
import { PriceListsPanel } from './PriceListsPanel';
import { VehiclePicker } from './VehiclePicker';
import { SettlementSettings } from './SettlementSettings';
import { NameSelector, methodLabel } from './NameSelector';
import { FixedPanel, FixedPicker } from './FixedPanel';
import { StatementPanel } from './StatementPanel';

/** البار الأعلى: ثلاث تابات فقط. */
type Tab = 'settlement' | 'statement' | 'settings';
/** أقسام تاب «التصفية» نفسها. */
type Sub = 'invoices' | 'pick' | 'prices' | 'supplier';

const LAST_KEY = 'dafater-settlement-name';

/** رقم العربية (رأس + مقطورة) من كشف العربية، وإلا رقم الفاتورة. */
function vehicleTitle(v: Vehicle) {
  return v.vehicleNo || v.vehicleLabel || `فاتورة #${v.invoiceNo}`;
}

export function SettlementView() {
  const { user } = useAuth();
  const isAdmin = !!user?.admin;
  const { data: partners, isLoading: loadingNames } = usePartners();
  const [picked, setPicked] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('settlement');
  const [sub, setSub] = useState<Sub>('invoices');
  const [openVehicle, setOpenVehicle] = useState<string | null>(null);

  // أول اسم، أو الاسم المختار في المرة السابقة
  useEffect(() => {
    if (!partners?.length) return;
    setPicked((cur) => {
      if (cur && partners.some((p) => p.id === cur)) return cur;
      let saved: string | null = null;
      try { saved = localStorage.getItem(LAST_KEY); } catch { /* ignore */ }
      return (saved && partners.some((p) => p.id === saved) ? saved : partners[0].id);
    });
  }, [partners]);

  const choose = (id: string) => {
    setPicked(id);
    setOpenVehicle(null);
    setSub('invoices');
    try { localStorage.setItem(LAST_KEY, id); } catch { /* ignore */ }
  };

  const partner = partners?.find((p) => p.id === picked) ?? null;
  const { data, isLoading, error } = useSettlementOverview(picked);

  const hasSupplier = !!partner?.suppliers.length;
  const isFixed = partner?.shareBasis === 'FIXED';

  // إعدادات التصفية للمالك فقط — صاحب الاسم يرى تصفيته وكشف حسابه
  const tabs: { value: Tab; label: string }[] = [
    { value: 'settlement', label: 'تصفية' },
    { value: 'statement', label: 'كشف حساب' },
    ...(isAdmin ? [{ value: 'settings' as Tab, label: 'إعدادات التصفية' }] : []),
  ];

  // أقسام تاب التصفية تتبع الطريقة والصلاحية: قوائم الأسعار والإيداعات لا
  // معنى لها بدون مورد، والتصفية الثابتة لا تقرأ من قوائم الأسعار أصلاً
  const subs: { value: Sub; label: string }[] = [
    { value: 'invoices', label: isFixed ? 'فواتير الشراء' : 'الفواتير' },
    ...(isAdmin ? [{ value: 'pick' as Sub, label: 'اختيار الفواتير' }] : []),
    ...(hasSupplier && !isFixed ? [{ value: 'prices' as Sub, label: 'قوائم أسعار المورد' }] : []),
    ...(hasSupplier && isAdmin ? [{ value: 'supplier' as Sub, label: 'الإيداعات والرصيد' }] : []),
  ];
  const subAvailable = subs.some((s) => s.value === sub);

  // القسم غير المتاح لهذا الاسم يرجع العرض إلى الفواتير
  useEffect(() => {
    if (partner && !subAvailable) setSub('invoices');
  }, [partner, subAvailable]);

  // تاب الإعدادات تختفي عن غير المالك
  useEffect(() => {
    if (!isAdmin && tab === 'settings') setTab('settlement');
  }, [isAdmin, tab]);

  if (loadingNames) return <Spinner />;

  if (!partners?.length) {
    return (
      <>
        <PageTitle title="تصفية" />
        <div className="card" style={{ padding: 18 }}>
          <b>{isAdmin ? 'لا توجد أسماء في التصفية.' : 'لا توجد تصفية مرتبطة بحسابك.'}</b>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            {isAdmin
              ? 'أضف أول اسم من الزر بالأعلى، ثم اضبط إعداداته.'
              : 'اطلب من المالك ربط حسابك باسمك في التصفية.'}
          </div>
        </div>
        {isAdmin && (
          <NameSelector
            partners={[]}
            picked={null}
            onPick={choose}
            canAdd
            onAdded={(id) => { choose(id); setTab('settings'); }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <PageTitle
        title="تصفية"
        subtitle={partner
          ? `تصفية حساب ${partner.name} — ${methodLabel(partner)}${
            partner.suppliers.length ? ` على أصناف ${partner.suppliers[0].name}` : ' — لم يتم تحديد المورد'
          }`
          : 'اختر اسماً'}
      />

      <NameSelector
        partners={partners}
        picked={picked}
        onPick={choose}
        canAdd={isAdmin}
        onAdded={(id) => { choose(id); setTab('settings'); }}
      />

      {error ? (
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <b className="err-text">{(error as Error).message}</b>
          {isAdmin && partner && (
            <div style={{ marginTop: 12 }}><SettlementSettings key={partner.id} partner={partner} /></div>
          )}
        </div>
      ) : isLoading || !data || !partner ? <Spinner /> : (
        <>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <SegmentedControl options={tabs} value={tab} onChange={setTab} />
          </div>

          {tab === 'settlement' && (
            <>
              {/* البطاقات تتبع طريقة التصفية: الحقل غير الخاص بالطريقة لا يظهر */}
              {isFixed ? (
                <StatsGrid columns={3}>
                  <StatCard
                    label={`إجمالي مستحق ${partner.name}`}
                    value={EGP(data.fixedTotals?.due ?? 0)}
                    variant="accent"
                  />
                  <StatCard label="إجمالي الكميات" value={QTY(data.fixedTotals?.qty ?? 0)} />
                  <StatCard
                    label="عدد فواتير الشراء"
                    value={QTY(data.fixedTotals?.invoices ?? 0)}
                    variant="blue"
                  />
                </StatsGrid>
              ) : (
                <StatsGrid columns={3}>
                  <StatCard label={`رأس مال ${partner.name}`} value={EGP(data.totals?.partnerCapital ?? 0)} />
                  <StatCard
                    label={`إجمالي نصيب ${partner.name}`}
                    value={EGP(data.totals?.share ?? 0)}
                    variant={(data.totals?.share ?? 0) < 0 ? 'debit' : 'accent'}
                  />
                  <StatCard label="عدد الفواتير" value={QTY(data.totals?.vehicles ?? 0)} variant="blue" />
                </StatsGrid>
              )}

              {!isFixed && (data.totals?.needsPricing ?? 0) > 0 && (
                <div className="card" style={{ padding: 10, marginTop: 10, borderColor: 'var(--debit)' }}>
                  <span style={{ fontSize: 12, color: 'var(--debit)', fontWeight: 700 }}>
                    تنبيه: {data.totals?.needsPricing} فاتورة فيها صنف بدون سعر. الفاتورة كلها
                    غير محسوبة وغير داخلة في الإجمالي حتى تُسعَّر أصنافها من قوائم أسعار المورد.
                  </span>
                </div>
              )}

              {!isFixed && (data.totals?.needsRate ?? 0) > 0 && (
                <div className="card" style={{ padding: 10, marginTop: 10, borderColor: 'var(--debit)' }}>
                  <span style={{ fontSize: 12, color: 'var(--debit)' }}>
                    تنبيه: {data.totals?.needsRate} فاتورة بالدولار بدون سعر صرف. الربح والنصيب
                    غير محسوبين، وغير داخلين في الإجمالي.
                  </span>
                </div>
              )}

              {isFixed && (data.fixedTotals?.needsAmount ?? 0) > 0 && (
                <div className="card" style={{ padding: 10, marginTop: 10, borderColor: 'var(--debit)' }}>
                  <span style={{ fontSize: 12, color: 'var(--debit)' }}>
                    تنبيه: {data.fixedTotals?.needsAmount} فاتورة بدون مبلغ للوحدة، فمستحقها
                    غير محسوب وغير داخل في الإجمالي.
                  </span>
                </div>
              )}

              {subs.length > 1 && (
                <div className="toolbar" style={{ marginTop: 12 }}>
                  <SegmentedControl options={subs} value={sub} onChange={setSub} />
                </div>
              )}

              {sub === 'invoices' && (isFixed
                ? <FixedPanel key={partner.id} partner={partner} />
                : (
                  <VehiclesTable
                    vehicles={data.vehicles}
                    totals={data.totals}
                    partner={partner}
                    onOpen={setOpenVehicle}
                  />
                ))}
              {sub === 'pick' && isAdmin && (isFixed
                ? <FixedPicker key={partner.id} partner={partner} />
                : <VehiclePicker key={partner.id} partner={partner} />)}
              {sub === 'prices' && hasSupplier && !isFixed && (
                <PriceListsPanel key={partner.id} partner={partner} />
              )}
              {sub === 'supplier' && hasSupplier && isAdmin && (
                <SupplierAccountPanel account={data.supplierAccount} />
              )}
            </>
          )}

          {tab === 'statement' && <StatementPanel key={partner.id} partner={partner} />}
          {tab === 'settings' && isAdmin && <SettlementSettings key={partner.id} partner={partner} />}
        </>
      )}

      {openVehicle && picked && partner && (
        <VehicleDetailModal
          partner={partner}
          id={openVehicle}
          onClose={() => setOpenVehicle(null)}
        />
      )}
    </>
  );
}

function VehiclesTable(
  { vehicles, totals, partner, onOpen }:
  {
    vehicles: Vehicle[];
    totals: CapitalTotals | null;
    partner: Partner;
    onOpen: (id: string) => void;
  },
) {
  const name = partner.name;

  if (!vehicles.length) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <b>لا توجد فواتير في تصفية {name} حتى الآن.</b>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          يحدد المالك الفواتير من «اختيار الفواتير»، ثم تظهر هنا بحسابها.
        </div>
      </div>
    );
  }

  // الإجماليات من السيرفر: محسوبة من الأرقام الخام ومستثنية الفواتير غير
  // المحسوبة، فلا يختلف تذييل الجدول عن البطاقات بقروش
  const sum = {
    capital: totals?.capital ?? 0,
    profit: totals?.profit ?? 0,
    share: totals?.share ?? 0,
  };

  return (
    <div className="card tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>العربية</th>
            <th>التاريخ</th>
            <th>العميل</th>
            <th className="num">رأس المال</th>
            <th className="num">نسبة {name}</th>
            <th className="num">الربح</th>
            <th className="num">نصيب {name}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => (
            <tr
              key={v.id}
              style={{
                cursor: 'pointer',
                // الفاتورة غير المحسوبة بعلامة حمراء واضحة على السطر كله
                ...(v.needsPricing
                  ? { background: 'var(--debit-soft, transparent)', outline: '1px solid var(--debit)' }
                  : {}),
              }}
              onClick={() => onOpen(v.id)}
              title={v.needsPricing
                ? 'فيها صنف بدون سعر — غير محسوبة. اضغط لمعرفة الصنف'
                : 'اضغط لعرض الأصناف وسعر شراء كل صنف'}
            >
              <td>
                <b>{vehicleTitle(v)}</b>
                {v.vehicleNo && <div className="muted" style={{ fontSize: 11 }}>فاتورة #{v.invoiceNo}</div>}
                {/* تنبيه أحمر واضح: الفاتورة كلها لا تُحسب حتى تُسعَّر أصنافها */}
                {v.unpricedCount > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--debit)', fontWeight: 700 }}>
                    {v.noPricePeriod
                      ? 'لا توجد قائمة أسعار لتاريخ الفاتورة — الفاتورة غير محسوبة'
                      : `${v.unpricedCount} صنف بدون سعر — الفاتورة غير محسوبة`}
                  </div>
                )}
                {!v.unpricedCount && !!v.warnings.length && (
                  <div style={{ fontSize: 11, color: 'var(--debit)' }}>{v.warnings.length} تنبيه</div>
                )}
              </td>
              <td>{fmtDate(v.date)}</td>
              <td>{v.clientName || '—'}</td>
              <td className="num">{EGP(v.capital)}</td>
              <td className="num">{v.needsPricing ? '—' : `${EGP(v.percent)}%`}</td>
              <td className="num" style={{ color: (v.profit ?? 0) < 0 ? 'var(--debit)' : undefined }}>
                {v.profit === null ? '—' : EGP(v.profit)}
              </td>
              <td className="num" style={{ color: (v.share ?? 0) < 0 ? 'var(--debit)' : undefined }}>
                <b>{v.share === null ? '—' : EGP(v.share)}</b>
              </td>
              <td className="muted" style={{ fontSize: 12 }}>التفاصيل ›</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={3}>الإجمالي المحسوب</th>
            <th className="num">{EGP(sum.capital)}</th>
            <th></th>
            <th className="num">{EGP(sum.profit)}</th>
            <th className="num">{EGP(sum.share)}</th>
            <th></th>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * الإيداعات تُسجل في تاب الدولار عن طريق الوسيط، وتظهر هنا للقراءة فقط.
 * الرصيد = الإيداعات − الفواتير، مثل أي حساب جاري عند المورد.
 */
function SupplierAccountPanel({ account }: { account: SupplierAccount | null }) {
  if (!account) return <EmptyState text="لا يوجد مورد محدد. حدده من إعدادات التصفية" />;
  // الإيداعات بالدولار دائماً، والفواتير تُحوَّل إليه قبل الطرح
  const cur = '$';

  return (
    <>
      <StatsGrid columns={3}>
        <StatCard label={`إجمالي الإيداعات (${cur})`} value={EGP(account.depositsTotal)} variant="blue" />
        <StatCard label={`فواتير ${account.party.name} (${cur})`} value={EGP(account.invoicesTotal)} variant="gold" />
        <StatCard
          label={`رصيد ${account.party.name} (${cur})`}
          value={EGP(account.balance)}
          variant={account.balance < 0 ? 'debit' : 'accent'}
        />
      </StatsGrid>
      <div className="muted" style={{ fontSize: 12, margin: '6px 2px 10px' }}>
        الرصيد = الإيداعات − الفواتير. الإيداعات تُسجل من تاب الدولار عن طريق الوسيط، وتظهر هنا للقراءة فقط.
        {Math.abs(account.ledgerBalance - account.balance) > 0.01 && (
          <>
            {' '}· رصيد الحساب الكامل في كشف الحساب <b className="num">{EGP(account.ledgerBalance)}</b>،
            والفرق من حركات أخرى على الحساب (شراء خارجي أو دفعات) غير داخلة في الإيداعات والفواتير.
          </>
        )}
      </div>
      {account.mixedCurrency && (
        <div className="card" style={{ padding: 10, marginBottom: 10, borderColor: 'var(--debit)' }}>
          <span style={{ fontSize: 12, color: 'var(--debit)' }}>
            تنبيه: {account.unconvertedInvoices} فاتورة بعملة غير الدولار وبدون سعر صرف، مستبعدة من الطرح.
          </span>
        </div>
      )}

      <div className="card tbl-wrap" style={{ marginBottom: 12 }}>
        <div style={{ padding: '10px 12px 0', fontWeight: 700 }}>الإيداعات</div>
        {!account.deposits.length ? <EmptyState text="لا توجد إيداعات" /> : (
          <table>
            <thead>
              <tr>
                <th>التاريخ</th><th>الوسيط</th><th className="num">المبلغ</th>
                <th className="num">سعر الإيداع</th><th className="num">القيمة بالجنيه</th><th>ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {account.deposits.map((d) => (
                <tr key={d.id}>
                  <td>{fmtDate(d.date)}</td>
                  <td>{d.agentName || '—'}</td>
                  <td className="num">{EGP(d.amount)}</td>
                  <td className="num">{EGP(d.depositRate)}</td>
                  <td className="num">{EGP(d.egpValue)}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{d.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card tbl-wrap">
        <div style={{ padding: '10px 12px 0', fontWeight: 700 }}>فواتير {account.party.name}</div>
        {!account.invoices.length ? <EmptyState text="لا توجد فواتير" /> : (
          <table>
            <thead>
              <tr><th>رقم</th><th>التاريخ</th><th className="num">الصافي</th><th className="num">سعر الصرف</th></tr>
            </thead>
            <tbody>
              {account.invoices.map((i) => (
                <tr key={i.id}>
                  <td>#{i.no}</td>
                  <td>{fmtDate(i.date)}</td>
                  <td className="num">{EGP(i.net)}</td>
                  <td className="num">{i.exchangeRate ? EGP(i.exchangeRate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
