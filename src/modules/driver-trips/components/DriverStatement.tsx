'use client';

import { useState } from 'react';
import { EGP, fmtDate } from '@/lib/format';
import { Spinner } from '@/components/common';
import { useDrivers } from '../../drivers/hooks';
import { useDriverTrips } from '../hooks';
import { DriverTripDetail } from './DriverTripDetail';
import type { DriverTrip } from '../dtos';

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * كشف السائق: بياناته من سجل السائقين، وتحته كل الرحلات اللي راحها ببياناتها.
 * الضغط على رحلة يفتح كشفها. مافيش مكاسب هنا — المكاسب في التقارير بس.
 */
export function DriverStatement({ driverName, onBack }: { driverName: string; onBack: () => void }) {
  const { data: driversPage, isLoading: ld } = useDrivers();
  const { data: allTrips, isLoading: lt } = useDriverTrips();
  const [openTrip, setOpenTrip] = useState<string | null>(null);

  if (ld || lt) return <Spinner />;

  const name = norm(driverName);
  const d = (driversPage?.data ?? []).find((x) => norm(x.name) === name);
  const trips = (allTrips ?? [])
    .filter((t) => norm(t.driverName) === name)
    .sort((a, b) => b.departureDate.localeCompare(a.departureDate));

  if (openTrip) {
    const t = trips.find((x) => x.id === openTrip);
    if (t) return <DriverTripDetail trip={t} onBack={() => setOpenTrip(null)} />;
  }

  const sum = (f: (t: DriverTrip) => number) => trips.reduce((s, t) => s + f(t), 0);
  const totFreight = sum((t) => t.agreedFreight);
  const totPaid = sum((t) => t.totalFreightPaid ?? 0);
  const totRemaining = sum((t) => t.remainingFreight ?? 0);
  const totDelay = sum((t) => t.remainingDelay ?? 0);
  const totWeight = sum((t) => t.remainingWeightDiff ?? 0);

  const info: [string, React.ReactNode][] = [
    ['اسم السائق', driverName],
    ['الرقم القومي', d?.nationalId],
    ['رقم الهاتف', [d?.phone, d?.phone2].filter(Boolean).join(' — ')],
    ['مسمّى العربية', d?.vehicleLabel],
    ['رقم العربية', d?.vehicleNo],
    ['رقم المقطورة', d?.trailerNo],
    ['ملاحظة', d?.note],
  ];

  return (
    <>
      <div className="toolbar no-print">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع</button>
        <button className="btn btn-primary btn-sm sp" onClick={() => window.print()}>🖨 طباعة</button>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <b style={{ fontSize: 15, display: 'block', marginBottom: 10 }}>بيانات السائق</b>
        <div className="mf-grid">
          {info.filter(([, v]) => !!v).map(([l, v]) => (
            <div key={l} className="mf-info"><span className="mf-info-l">{l}</span><span className="mf-info-v">{v}</span></div>
          ))}
        </div>
        {!d && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>السائق غير مسجل في سجل السائقين.</div>}
        {d && (d.totalAdvance ?? 0) > 0 && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 12.5, fontWeight: 700 }}>
            <span>سلفة مصروفة: <span className="num deb">{EGP(d.totalAdvance ?? 0)}</span></span>
            <span>عطلات مكتسبة: <span className="num cre">{EGP(d.delayEarned ?? 0)}</span></span>
            <span>متبقي السلفة على السائق: <span className="num deb">{EGP(d.outstandingAdvance ?? 0)}</span></span>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <b style={{ fontSize: 15 }}>الرحلات</b>
          <span className="pill">{trips.length} رحلة</span>
        </div>
        {trips.length === 0 ? (
          <div className="empty">لا توجد رحلات لهذا السائق</div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>الطلوع</th>
                  <th>الوصول</th>
                  <th>العميل</th>
                  <th>العربية</th>
                  <th>كشف العربية</th>
                  <th>الفاتورة</th>
                  <th className="num">الناولون</th>
                  <th className="num">المدفوع</th>
                  <th className="num">المتبقي</th>
                  <th className="num">عطلة / فرق وزن</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t) => {
                  const extra = (t.remainingDelay ?? 0) + (t.remainingWeightDiff ?? 0);
                  const doc = t.invoice ? `فاتورة ${t.invoice.no}` : t.deal ? `بيع خارجي ${t.deal.no}` : null;
                  return (
                    <tr key={t.id} style={{ cursor: 'pointer' }} title="اضغط لعرض الرحلة" onClick={() => setOpenTrip(t.id)}>
                      <td className="num">{fmtDate(t.departureDate)}</td>
                      <td className="num">{t.arrivalDate ? fmtDate(t.arrivalDate) : <span className="muted">—</span>}</td>
                      <td>{t.clientName}</td>
                      <td>
                        {[t.vehicleLabel, t.vehicleNo].filter(Boolean).join(' — ') || '—'}
                        {t.trailerNo && <div className="muted" style={{ fontSize: 11.5 }}>مقطورة {t.trailerNo}</div>}
                      </td>
                      <td>{t.manifest ? `#${t.manifest.no}` : <span className="mt-status st-unlinked" style={{ fontSize: 11 }}>غير مربوط</span>}</td>
                      <td>{doc ?? <span className="mt-status st-unlinked" style={{ fontSize: 11 }}>غير مربوطة</span>}</td>
                      <td className="num">{EGP(t.agreedFreight)}</td>
                      <td className="num cre">{EGP(t.totalFreightPaid ?? 0)}</td>
                      <td className={`num ${(t.remainingFreight ?? 0) > 0 ? 'deb' : ''}`}>{EGP(t.remainingFreight ?? 0)}</td>
                      <td className={`num ${extra > 0 ? 'deb' : ''}`}>{extra > 0 ? EGP(extra) : '—'}</td>
                      <td>{t.trulyClosed ? 'مكتملة' : t.arrivalDate ? 'وصل' : 'جارية'}</td>
                    </tr>
                  );
                })}
                <tr className="mf-total" style={{ fontWeight: 800 }}>
                  <td colSpan={6}><b>الإجمالي</b></td>
                  <td className="num"><b>{EGP(totFreight)}</b></td>
                  <td className="num"><b>{EGP(totPaid)}</b></td>
                  <td className="num"><b>{EGP(totRemaining)}</b></td>
                  <td className="num"><b>{totDelay + totWeight > 0 ? EGP(totDelay + totWeight) : '—'}</b></td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
