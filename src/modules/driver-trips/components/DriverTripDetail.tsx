'use client';

import { useState } from 'react';
import { EGP, fmtDate, todayISO } from '@/lib/format';
import { Field, MoneyInput } from '@/components/common';
import { useAddPayment, useDeletePayment, useSetArrival } from '../hooks';
import type { DriverTrip } from '../dtos';

const DELAY_THRESHOLD = 8;
const DELAY_RATE = 1200;

function daysBetween(from: string, to: string) {
  return Math.ceil(
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24),
  );
}

interface Props {
  trip: DriverTrip;
  onBack: () => void;
}

export function DriverTripDetail({ trip, onBack }: Props) {
  const addPayment = useAddPayment();
  const deletePayment = useDeletePayment();
  const setArrival = useSetArrival();

  const [payDate, setPayDate] = useState(todayISO());
  const [payAmt, setPayAmt] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payErr, setPayErr] = useState('');
  const [showPayForm, setShowPayForm] = useState(false);

  const [arrivalDate, setArrivalDate] = useState(todayISO());
  const [showArrival, setShowArrival] = useState(false);
  const [arrErr, setArrErr] = useState('');

  const freightPaid = trip.payments.filter((p) => p.paymentType === 'freight').reduce((s, p) => s + p.amount, 0);
  const delayPaid   = trip.payments.filter((p) => p.paymentType === 'delay').reduce((s, p) => s + p.amount, 0);
  const teaPaid     = trip.payments.filter((p) => p.paymentType === 'tea').reduce((s, p) => s + p.amount, 0);
  const wdPaid      = trip.payments.filter((p) => p.paymentType === 'weightDiff').reduce((s, p) => s + p.amount, 0);
  const totalPaid   = freightPaid + delayPaid + teaPaid + wdPaid;
  const remaining   = Math.max(0, trip.agreedFreight - freightPaid);

  const isClosed  = !!trip.arrivalDate;
  const days      = isClosed ? daysBetween(trip.departureDate, trip.arrivalDate!) : null;
  const delayFee  = trip.delayFee ?? 0;
  const delayDays = days !== null ? Math.max(0, days - DELAY_THRESHOLD) : 0;
  const remainingDelay    = Math.max(0, delayFee - delayPaid);
  const hasUnpaidDelay    = isClosed && delayFee > 0 && remainingDelay > 0;
  const isTrulyClosed     = isClosed && remainingDelay === 0;

  // Preview if arrival not yet set
  const previewDays = !isClosed ? daysBetween(trip.departureDate, arrivalDate) : null;
  const previewDelay = previewDays !== null ? Math.max(0, previewDays - DELAY_THRESHOLD) : 0;
  const previewFee = previewDelay * DELAY_RATE;

  const savePayment = () => {
    setPayErr('');
    if (!Number(payAmt) || Number(payAmt) <= 0) return setPayErr('اكتب المبلغ');
    addPayment.mutate(
      { id: trip.id, dto: { date: payDate, amount: Number(payAmt), note: payNote || undefined } },
      {
        onSuccess: () => { setPayAmt(''); setPayNote(''); setShowPayForm(false); },
        onError: (e: any) => setPayErr(e.message),
      },
    );
  };

  const saveArrival = () => {
    setArrErr('');
    if (!arrivalDate) return setArrErr('اختر تاريخ الوصول');
    if (new Date(arrivalDate) < new Date(trip.departureDate)) return setArrErr('تاريخ الوصول قبل الطلوع!');
    const msg = previewDelay > 0 && trip.party
      ? `سيتم تسجيل عطلة ${previewDelay} يوم × ${EGP(DELAY_RATE)} = ${EGP(previewFee)} على حساب ${trip.party.name}. تأكيد؟`
      : previewDelay > 0
        ? `${previewDelay} يوم عطلة (${EGP(previewFee)}) — ملاحظة: العميل غير مرتبط بحساب، لن يُرحَّل الرقم. تأكيد؟`
        : `تسجيل وصول — ${previewDays} يوم. تأكيد؟`;
    if (!window.confirm(msg)) return;
    setArrival.mutate(
      { id: trip.id, arrivalDate },
      { onSuccess: () => setShowArrival(false), onError: (e: any) => setArrErr(e.message) },
    );
  };

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 12 }}>→ رجوع للقائمة</button>

      {/* Header card */}
      <div className="card" style={{ padding: 18, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{trip.driverName}</div>
            {trip.vehicleNo && <div className="muted" style={{ fontSize: 13 }}>عربية: {trip.vehicleNo}{trip.trailerNo ? ` — مقطورة: ${trip.trailerNo}` : ''}</div>}
            <div className="muted" style={{ fontSize: 13 }}>العميل: {trip.clientName}</div>
            {trip.party && <div className="muted" style={{ fontSize: 12 }}>حساب: {trip.party.name}</div>}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div className="muted" style={{ fontSize: 12 }}>تاريخ الطلوع</div>
            <div style={{ fontWeight: 700 }}>{fmtDate(trip.departureDate)}</div>
            {isClosed && (
              <>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>تاريخ الوصول</div>
                <div style={{ fontWeight: 700 }}>{fmtDate(trip.arrivalDate!)}</div>
              </>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginTop: 14 }}>
          {[
            ['الناولون المتفق', EGP(trip.agreedFreight), ''],
            ['ناولون مدفوع', EGP(freightPaid), 'cre'],
            ['متبقي ناولون', EGP(remaining), remaining > 0 ? 'deb' : 'cre'],
            ...(isClosed ? [
              ['مدة الرحلة', `${days} يوم`, ''],
              ...(delayDays > 0 ? [
                ['أيام العطلة', `${delayDays} يوم`, 'deb'],
                ['إجمالي العطلة', EGP(delayFee), 'deb'],
                ['مدفوع من العطلة', EGP(delayPaid), delayPaid > 0 ? 'cre' : ''],
                ['متبقي من العطلة', EGP(remainingDelay), remainingDelay > 0 ? 'deb' : 'cre'],
              ] : [['الرحلة', 'في المعاد ✓', 'cre']]),
            ] : []),
          ].map(([label, val, cls]) => (
            <div key={label} className="card" style={{ padding: '10px 14px', background: 'var(--bg-soft)' }}>
              <div className="muted" style={{ fontSize: 11 }}>{label}</div>
              <div className={`num ${cls}`} style={{ fontWeight: 700, fontSize: 15 }}>{val}</div>
            </div>
          ))}
        </div>

        {isClosed && delayDays > 0 && (
          <div style={{ marginTop: 10, padding: '8px 14px', background: 'var(--debit-bg)', borderRadius: 8, fontSize: 13, color: 'var(--debit)' }}>
            {trip.party
              ? `✓ تم ترحيل عطلة ${EGP(delayFee)} على حساب ${trip.party.name}`
              : `تنبيه: أيام العطلة ${delayDays} يوم × ${EGP(DELAY_RATE)} = ${EGP(delayFee)} — لم يُرحَّل (لا يوجد حساب مرتبط)`}
          </div>
        )}

        {hasUnpaidDelay && (
          <div style={{
            marginTop: 10, padding: '12px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: '#fff3e0', color: '#e67e00', border: '1.5px solid #e67e00',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>⏳</span>
            <span>
              عطلة غير مدفوعة — {EGP(remainingDelay)} متبقي.
              {' '}ادفع من <b>الإدخال اليومي → سائقين</b> حتى تُعتبر الرحلة مكتملة.
            </span>
          </div>
        )}
      </div>

      {/* Payments section */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <b style={{ fontSize: 14 }}>المدفوعات للسائق</b>
          {!showPayForm && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowPayForm(true)}>+ دفعة جديدة</button>
          )}
        </div>

        {showPayForm && (
          <div style={{ background: 'var(--bg-soft)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Field label="التاريخ">
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} style={{ maxWidth: 160 }} />
              </Field>
              <Field label="المبلغ (ج.م)">
                <MoneyInput value={payAmt} onChange={setPayAmt} placeholder="0.00" style={{ maxWidth: 130 }} />
              </Field>
              <Field label="ملاحظة">
                <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="اختياري…" style={{ maxWidth: 200 }} />
              </Field>
            </div>
            {payErr && <div className="err-text" style={{ marginTop: 6 }}>{payErr}</div>}
            <div className="toolbar" style={{ marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={savePayment} disabled={addPayment.isPending}>
                {addPayment.isPending ? '...' : 'حفظ الدفعة'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowPayForm(false); setPayErr(''); }}>إلغاء</button>
            </div>
          </div>
        )}

        {trip.payments.length === 0 ? (
          <div className="empty">لا توجد دفعات بعد</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['التاريخ', 'النوع', 'المبلغ', 'ملاحظة', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--line)', fontSize: 12, color: 'var(--muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trip.payments.map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--line-soft)' }}>{fmtDate(p.date)}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--line-soft)' }}>
                    {(() => {
                      const cfg: Record<string, { label: string; bg: string; color: string }> = {
                        freight:    { label: 'ناولون',   bg: 'var(--credit-bg)', color: 'var(--credit)' },
                        delay:      { label: 'عطلة',    bg: '#fff3e0',          color: '#e67e00' },
                        tea:        { label: 'شاي',     bg: '#f3e8ff',          color: '#7c3aed' },
                        weightDiff: { label: 'فرق وزن', bg: '#e0f2fe',          color: '#0369a1' },
                      };
                      const c = cfg[p.paymentType] ?? cfg.freight;
                      return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: c.bg, color: c.color }}>{c.label}</span>;
                    })()}
                  </td>
                  <td className="num cre" style={{ padding: '8px', borderBottom: '1px solid var(--line-soft)', fontWeight: 700 }}>{EGP(p.amount)}</td>
                  <td className="muted" style={{ padding: '8px', borderBottom: '1px solid var(--line-soft)', fontSize: 12 }}>{p.note || '—'}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--line-soft)' }}>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (!window.confirm('حذف هذه الدفعة؟')) return;
                        deletePayment.mutate({ tripId: trip.id, payId: p.id });
                      }}
                      disabled={deletePayment.isPending}
                    >حذف</button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} style={{ padding: '8px', fontWeight: 700, textAlign: 'left', fontSize: 13 }}>
                  ناولون: <span className="num cre">{EGP(freightPaid)}</span>
                  {delayPaid > 0 && <> &nbsp;|&nbsp; عطلة: <span className="num cre">{EGP(delayPaid)}</span></>}
                  {teaPaid > 0 && <> &nbsp;|&nbsp; شاي: <span className="num" style={{ color: '#7c3aed' }}>{EGP(teaPaid)}</span></>}
                  {wdPaid > 0 && <> &nbsp;|&nbsp; فرق وزن: <span className="num" style={{ color: '#0369a1' }}>{EGP(wdPaid)}</span></>}
                  &nbsp;|&nbsp; الإجمالي: <span className="num cre">{EGP(totalPaid)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Arrival section */}
      {!isClosed && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showArrival ? 12 : 0 }}>
            <b style={{ fontSize: 14 }}>تسجيل الوصول</b>
            {!showArrival && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowArrival(true)}>تسجيل وصول</button>
            )}
          </div>
          {showArrival && (
            <>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="تاريخ الوصول">
                  <input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} />
                </Field>
                {arrivalDate && (
                  <div style={{ paddingBottom: 2 }}>
                    {(() => {
                      const d = daysBetween(trip.departureDate, arrivalDate);
                      const del = Math.max(0, d - DELAY_THRESHOLD);
                      return (
                        <div style={{ display: 'flex', gap: 10 }}>
                          <div className="card" style={{ padding: '8px 14px', background: 'var(--bg-soft)', textAlign: 'center' }}>
                            <div className="muted" style={{ fontSize: 11 }}>المدة</div>
                            <div style={{ fontWeight: 700 }}>{d} يوم</div>
                          </div>
                          {del > 0 && (
                            <div className="card" style={{ padding: '8px 14px', background: 'var(--debit-bg)', textAlign: 'center' }}>
                              <div className="muted" style={{ fontSize: 11 }}>عطلة</div>
                              <div className="deb" style={{ fontWeight: 700 }}>{del} يوم = {EGP(del * DELAY_RATE)}</div>
                            </div>
                          )}
                          {del === 0 && (
                            <div className="card" style={{ padding: '8px 14px', background: 'var(--credit-bg)', textAlign: 'center' }}>
                              <div className="cre" style={{ fontWeight: 700 }}>في المعاد ✓</div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              {arrErr && <div className="err-text" style={{ marginTop: 8 }}>{arrErr}</div>}
              <div className="toolbar" style={{ marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={saveArrival} disabled={setArrival.isPending}>
                  {setArrival.isPending ? '...' : 'تأكيد الوصول'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowArrival(false); setArrErr(''); }}>إلغاء</button>
              </div>
            </>
          )}
        </div>
      )}

      {isClosed && (
        <div style={{ padding: '8px 0', color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
          الرحلة مغلقة — وصل {fmtDate(trip.arrivalDate!)} ({days} يوم)
        </div>
      )}
    </div>
  );
}
