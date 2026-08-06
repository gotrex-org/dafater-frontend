'use client';

import { useState } from 'react';
import { EGP, fmtDate, todayISO } from '@/lib/format';
import { Field, Combobox, MoneyInput, PlateInput, parsePlate, buildPlate } from '@/components/common';
import { useAllParties } from '../../parties/hooks';
import { useAllTreasury } from '../../treasury/hooks';
import { useConfig } from '../../config/hooks';
import { useAddPayment, useDeletePayment, useSetArrival, useUpdateDriverTrip, useUpdateWeightDiff } from '../hooks';
import type { DriverTrip } from '../dtos';

// Fallbacks only — actual values come from useConfig() (إعدادات رحلات السائقين)
// and are what the backend actually computes with.
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
  const addPayment      = useAddPayment();
  const deletePayment   = useDeletePayment();
  const setArrival      = useSetArrival();
  const updateTrip      = useUpdateDriverTrip();
  const updateWeightDiff = useUpdateWeightDiff();
  const { data: parties } = useAllParties('CLIENT');
  const { data: treasury } = useAllTreasury();
  const { data: config } = useConfig();
  const allTreasury = treasury?.data ?? [];
  const allClients = parties?.data ?? [];
  const graceDays = config?.delayGraceDays ?? DELAY_THRESHOLD;
  const feeRate = config?.delayFeePerDay ?? DELAY_RATE;

  // ─── Edit form state ──────────────────────────────────────────────────────
  const [showEdit, setShowEdit]       = useState(false);
  const [editName, setEditName]       = useState(trip.driverName);
  const [editPartyId, setEditPartyId] = useState(trip.party?.id ?? '');
  const [editClientName, setEditClientName] = useState(trip.clientName);

  const vehParsed = parsePlate(trip.vehicleNo);
  const trlParsed = parsePlate(trip.trailerNo);
  const [editVehL, setEditVehL]           = useState(vehParsed.letters);
  const [editVehNums, setEditVehNums]     = useState(vehParsed.numbers);
  const [editTrlL, setEditTrlL]           = useState(trlParsed.letters);
  const [editTrlNums, setEditTrlNums]     = useState(trlParsed.numbers);
  const [editDep, setEditDep]             = useState(trip.departureDate.slice(0, 10));
  const [editFreight, setEditFreight]     = useState(String(trip.agreedFreight));
  const [editNote, setEditNote]           = useState(trip.note ?? '');
  const [editErr, setEditErr]             = useState('');

  const openEdit = () => {
    setEditName(trip.driverName);
    setEditPartyId(trip.party?.id ?? '');
    setEditClientName(trip.clientName);
    const v = parsePlate(trip.vehicleNo); setEditVehL(v.letters); setEditVehNums(v.numbers);
    const t = parsePlate(trip.trailerNo); setEditTrlL(t.letters); setEditTrlNums(t.numbers);
    setEditDep(trip.departureDate.slice(0, 10));
    setEditFreight(String(trip.agreedFreight));
    setEditNote(trip.note ?? '');
    setEditErr('');
    setShowEdit(true);
  };

  const saveEdit = () => {
    setEditErr('');
    if (!editName.trim()) return setEditErr('اكتب اسم السائق');
    if (!editFreight || Number(editFreight) <= 0) return setEditErr('اكتب الناولون المتفق عليه');
    const selClient = allClients.find((c) => c.id === editPartyId);
    updateTrip.mutate(
      {
        id: trip.id,
        dto: {
          driverName:   editName.trim(),
          partyId:      editPartyId || undefined,
          clientName:   selClient?.name ?? editClientName,
          vehicleNo:    buildPlate(editVehL, editVehNums),
          trailerNo:    buildPlate(editTrlL, editTrlNums),
          departureDate: editDep,
          agreedFreight: Number(editFreight),
          note:          editNote.trim() || undefined,
        },
      },
      {
        onSuccess: () => setShowEdit(false),
        onError: (e: any) => setEditErr(e.message),
      },
    );
  };

  // ─── Payment / arrival state ──────────────────────────────────────────────
  const [payDate, setPayDate] = useState(todayISO());
  const [payAmt, setPayAmt] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payErr, setPayErr] = useState('');
  const [showPayForm, setShowPayForm] = useState(false);

  const [arrivalDate, setArrivalDate] = useState(todayISO());
  const [arrWeightDiff, setArrWeightDiff] = useState('');
  const [showArrival, setShowArrival] = useState(false);
  const [arrErr, setArrErr] = useState('');

  const [showEditWD, setShowEditWD] = useState(false);
  const [editWDAmount, setEditWDAmount] = useState('');
  const [editWDErr, setEditWDErr] = useState('');

  const freightPaid = trip.payments.filter((p) => p.paymentType === 'freight').reduce((s, p) => s + p.amount, 0);
  const delayPaid   = trip.payments.filter((p) => p.paymentType === 'delay').reduce((s, p) => s + p.amount, 0);
  const advancePaid = trip.payments.filter((p) => p.paymentType === 'advance').reduce((s, p) => s + p.amount, 0);
  const teaPaid     = trip.payments.filter((p) => p.paymentType === 'tea').reduce((s, p) => s + p.amount, 0);
  const wdPaid      = trip.payments.filter((p) => p.paymentType === 'weightDiff').reduce((s, p) => s + p.amount, 0);
  const totalPaid   = freightPaid + delayPaid + advancePaid + teaPaid + wdPaid;
  const remaining   = Math.max(0, trip.agreedFreight - freightPaid);

  const isClosed        = !!trip.arrivalDate;
  const days            = isClosed ? daysBetween(trip.departureDate, trip.arrivalDate!) : null;
  const delayFee        = trip.delayFee ?? 0;
  const weightDiffTotal = trip.weightDiffAmount ?? 0;
  const delayDays       = days !== null ? Math.max(0, days - graceDays) : 0;
  // السلفة بتتخصم من رصيد العطلات زي دفعة العطلة. الصافي ممكن يبقى سالب (سلفة مقدمة → السائق مدين).
  const delayNet        = delayFee - delayPaid - advancePaid;
  const remainingDelay  = Math.max(0, delayNet);
  const advanceOver     = Math.max(0, -delayNet); // سلفة زيادة عن رصيد العطلات (على السائق)
  const remainingWD     = Math.max(0, weightDiffTotal - wdPaid);
  const hasUnpaidDelay  = isClosed && delayFee > 0 && remainingDelay > 0;
  const hasUnpaidWD     = isClosed && weightDiffTotal > 0 && remainingWD > 0;
  const isTrulyClosed   = isClosed && remainingDelay === 0 && remainingWD === 0;

  // Live preview of the entered arrivalDate (used both for the initial "تسجيل
  // الوصول" flow and when correcting an already-closed trip's arrival date).
  const previewDays = daysBetween(trip.departureDate, arrivalDate);
  const previewDelay = Math.max(0, previewDays - graceDays);
  const previewFee = previewDelay * feeRate;

  const [payType, setPayType] = useState<'freight' | 'delay' | 'weightDiff' | 'advance'>('freight');
  const [payTreasuryId, setPayTreasuryId] = useState('');

  const savePayment = () => {
    setPayErr('');
    if (!Number(payAmt) || Number(payAmt) <= 0) return setPayErr('اكتب المبلغ');
    if (!payTreasuryId) return setPayErr('اختر الخزنة اللي المبلغ خارج منها');
    addPayment.mutate(
      { id: trip.id, dto: { date: payDate, amount: Number(payAmt), note: payNote || undefined, paymentType: payType, treasuryId: payTreasuryId || undefined } },
      {
        onSuccess: () => { setPayAmt(''); setPayNote(''); setPayTreasuryId(''); setShowPayForm(false); },
        onError: (e: any) => setPayErr(e.message),
      },
    );
  };

  const openEditArrival = () => {
    setArrivalDate(trip.arrivalDate!.slice(0, 10));
    setArrWeightDiff(weightDiffTotal > 0 ? String(weightDiffTotal) : '');
    setArrErr('');
    setShowArrival(true);
  };

  const saveArrival = () => {
    setArrErr('');
    if (!arrivalDate) return setArrErr('اختر تاريخ الوصول');
    if (new Date(arrivalDate) < new Date(trip.departureDate)) return setArrErr('تاريخ الوصول قبل الطلوع!');
    const wd = Number(arrWeightDiff) || 0;
    const parts: string[] = [];
    if (previewDelay > 0) parts.push(`عطلة ${previewDelay} يوم = ${EGP(previewFee)}`);
    if (wd > 0) parts.push(`فرق وزن ${EGP(wd)}`);
    const hasParty = !!trip.party;
    const partyNote = hasParty ? ` على حساب ${trip.party!.name}` : ' (لا يوجد حساب مرتبط — لن يُرحَّل)';
    const verb = isClosed ? 'سيتم تعديل' : 'سيتم ترحيل';
    const msg = parts.length > 0
      ? `${verb}: ${parts.join(' + ')}${partyNote}. تأكيد؟`
      : `${isClosed ? 'تعديل تاريخ الوصول' : 'تسجيل وصول'} — ${previewDays} يوم. تأكيد؟`;
    if (!window.confirm(msg)) return;
    setArrival.mutate(
      // explicit 0 (not `wd || undefined`) so correcting a trip's weight-diff
      // down to zero actually clears it instead of falling back to the old value
      { id: trip.id, arrivalDate, weightDiffAmount: wd },
      { onSuccess: () => { setShowArrival(false); setArrWeightDiff(''); }, onError: (e: any) => setArrErr(e.message) },
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>تاريخ الطلوع</div>
              <div style={{ fontWeight: 700 }}>{fmtDate(trip.departureDate)}</div>
              {isClosed && (
                <>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>تاريخ الوصول</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontWeight: 700 }}>{fmtDate(trip.arrivalDate!)}</div>
                    {!showArrival && (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 6px' }} onClick={openEditArrival}>✏</button>
                    )}
                  </div>
                </>
              )}
            </div>
            {!showEdit && (
              <button className="btn btn-ghost btn-sm" onClick={openEdit} style={{ fontSize: 12 }}>✏ تعديل البيانات</button>
            )}
          </div>
        </div>

        {/* Inline edit form */}
        {showEdit && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
            <b style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>تعديل بيانات الرحلة</b>
            <div className="form-grid">
              <Field label="اسم السائق">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </Field>
              <Field label="العميل (حساب)">
                <Combobox options={allClients} value={editPartyId} onChange={(id) => { setEditPartyId(id); setEditClientName(allClients.find((c) => c.id === id)?.name ?? editClientName); }} placeholder="اختر أو اتركه…" />
              </Field>
              <Field label="رقم العربية">
                <PlateInput letters={editVehL} numbers={editVehNums} onLettersChange={setEditVehL} onNumbersChange={setEditVehNums} numRef={{ current: null } as any} />
              </Field>
              <Field label="رقم المقطورة">
                <PlateInput letters={editTrlL} numbers={editTrlNums} onLettersChange={setEditTrlL} onNumbersChange={setEditTrlNums} numRef={{ current: null } as any} />
              </Field>
              <Field label="تاريخ الطلوع">
                <input type="date" value={editDep} onChange={(e) => setEditDep(e.target.value)} />
              </Field>
              <Field label="الناولون المتفق عليه (ج.م)">
                <MoneyInput value={editFreight} onChange={setEditFreight} placeholder="0.00" />
              </Field>
              <Field label="ملاحظة" full>
                <input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="اختياري…" />
              </Field>
            </div>
            {editErr && <div className="err-text" style={{ marginTop: 8 }}>{editErr}</div>}
            <div className="toolbar" style={{ marginTop: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={updateTrip.isPending}>
                {updateTrip.isPending ? '...' : 'حفظ التعديلات'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowEdit(false); setEditErr(''); }}>إلغاء</button>
            </div>
          </div>
        )}


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
                ...(advancePaid > 0 ? [['سلفة (تُخصم من العطلة)', EGP(advancePaid), 'deb'] as [string, string, string]] : []),
                ['متبقي من العطلة', EGP(remainingDelay), remainingDelay > 0 ? 'deb' : 'cre'],
                ...(advanceOver > 0 ? [['سلفة زيادة (على السائق)', EGP(advanceOver), 'deb'] as [string, string, string]] : []),
              ] : advancePaid > 0 ? [['سلفة للسائق', EGP(advancePaid), 'deb'] as [string, string, string]] : [['الرحلة', 'في المعاد ✓', 'cre']]),
              ...(weightDiffTotal > 0 ? [
                ['فرق وزن (على العميل)', EGP(weightDiffTotal), 'deb'],
                ['مدفوع للسائق', EGP(wdPaid), wdPaid > 0 ? 'cre' : ''],
                ['متبقي فرق وزن', EGP(remainingWD), remainingWD > 0 ? 'deb' : 'cre'],
              ] : []),
            ] : []),
          ].map(([label, val, cls]) => (
            <div key={label} className="card" style={{ padding: '10px 14px', background: 'var(--bg-soft)' }}>
              <div className="muted" style={{ fontSize: 11 }}>{label}</div>
              <div className={`num ${cls}`} style={{ fontWeight: 700, fontSize: 15 }}>{val}</div>
            </div>
          ))}
        </div>

        {isClosed && (delayDays > 0 || weightDiffTotal > 0) && (
          <div style={{ marginTop: 10, padding: '8px 14px', background: 'var(--debit-bg)', borderRadius: 8, fontSize: 13, color: 'var(--debit)' }}>
            {trip.party ? (
              <>
                {delayDays > 0 && <div>✓ تم ترحيل عطلة {EGP(delayFee)} على حساب {trip.party.name}</div>}
                {weightDiffTotal > 0 && <div>✓ تم ترحيل فرق وزن {EGP(weightDiffTotal)} على حساب {trip.party.name}</div>}
              </>
            ) : (
              <div>تنبيه: لم يُرحَّل شيء — لا يوجد حساب مرتبط</div>
            )}
          </div>
        )}

        {(hasUnpaidDelay || hasUnpaidWD) && (
          <div style={{
            marginTop: 10, padding: '12px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: '#fff3e0', color: '#e67e00', border: '1.5px solid #e67e00',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>⏳</span>
            <span>
              {hasUnpaidDelay && <>عطلة غير مدفوعة — {EGP(remainingDelay)} متبقي. </>}
              {hasUnpaidWD && <>فرق وزن غير مدفوع للسائق — {EGP(remainingWD)} متبقي. </>}
            </span>
          </div>
        )}

        {isClosed && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            {!showEditWD ? (
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                onClick={() => { setEditWDAmount(String(weightDiffTotal)); setEditWDErr(''); setShowEditWD(true); }}>
                ✏ تعديل مبلغ فرق الوزن
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg-soft)', borderRadius: 8, padding: '10px 14px' }}>
                <Field label={`فرق وزن جديد (كان ${EGP(weightDiffTotal)})`}>
                  <MoneyInput value={editWDAmount} onChange={setEditWDAmount} placeholder="0.00" style={{ maxWidth: 140 }} />
                </Field>
                {editWDErr && <div className="err-text" style={{ fontSize: 12 }}>{editWDErr}</div>}
                <div className="toolbar" style={{ padding: 0 }}>
                  <button className="btn btn-primary btn-sm"
                    disabled={updateWeightDiff.isPending}
                    onClick={() => {
                      setEditWDErr('');
                      const newAmt = Number(editWDAmount);
                      if (isNaN(newAmt) || newAmt < 0) return setEditWDErr('مبلغ غير صحيح');
                      updateWeightDiff.mutate(
                        { id: trip.id, amount: newAmt },
                        {
                          onSuccess: () => { setShowEditWD(false); setEditWDAmount(''); },
                          onError: (e: any) => setEditWDErr(e.message),
                        },
                      );
                    }}>
                    {updateWeightDiff.isPending ? '...' : 'حفظ'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowEditWD(false); setEditWDErr(''); }}>إلغاء</button>
                </div>
              </div>
            )}
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
              <Field label="نوع الدفعة">
                <select value={payType} onChange={(e) => setPayType(e.target.value as any)} style={{ minWidth: 120 }}>
                  <option value="freight">ناولون</option>
                  {(trip.delayFee ?? 0) > 0 && <option value="delay">عطلة</option>}
                  <option value="advance">سلفة</option>
                  {weightDiffTotal > 0 && <option value="weightDiff">فرق وزن</option>}
                </select>
              </Field>
              <Field label="المبلغ (ج.م)">
                <MoneyInput value={payAmt} onChange={setPayAmt} placeholder="0.00" style={{ maxWidth: 130 }} />
              </Field>
              <Field label="الخزنة">
                <Combobox options={allTreasury} value={payTreasuryId} onChange={setPayTreasuryId} placeholder="اختر الخزنة…" />
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
                        advance:    { label: 'سلفة',    bg: '#fee2e2',          color: '#b91c1c' },
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
                  {advancePaid > 0 && <> &nbsp;|&nbsp; سلفة: <span className="num" style={{ color: '#b91c1c' }}>{EGP(advancePaid)}</span></>}
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
      {(!isClosed || showArrival) && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showArrival ? 12 : 0 }}>
            <b style={{ fontSize: 14 }}>{isClosed ? 'تعديل تاريخ الوصول' : 'تسجيل الوصول'}</b>
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
                <Field label="فرق وزن (ج.م) — اختياري">
                  <MoneyInput value={arrWeightDiff} onChange={setArrWeightDiff} placeholder="0.00" style={{ maxWidth: 140 }} />
                </Field>
                {arrivalDate && (
                  <div style={{ paddingBottom: 2 }}>
                    {(() => {
                      const d = daysBetween(trip.departureDate, arrivalDate);
                      const del = Math.max(0, d - graceDays);
                      return (
                        <div style={{ display: 'flex', gap: 10 }}>
                          <div className="card" style={{ padding: '8px 14px', background: 'var(--bg-soft)', textAlign: 'center' }}>
                            <div className="muted" style={{ fontSize: 11 }}>المدة</div>
                            <div style={{ fontWeight: 700 }}>{d} يوم</div>
                          </div>
                          {del > 0 && (
                            <div className="card" style={{ padding: '8px 14px', background: 'var(--debit-bg)', textAlign: 'center' }}>
                              <div className="muted" style={{ fontSize: 11 }}>عطلة</div>
                              <div className="deb" style={{ fontWeight: 700 }}>{del} يوم = {EGP(del * feeRate)}</div>
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
                  {setArrival.isPending ? '...' : (isClosed ? 'حفظ التعديل' : 'تأكيد الوصول')}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowArrival(false); setArrErr(''); }}>إلغاء</button>
              </div>
            </>
          )}
        </div>
      )}

      {isClosed && !showArrival && (
        <div style={{ padding: '8px 0', color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
          الرحلة مغلقة — وصل {fmtDate(trip.arrivalDate!)} ({days} يوم)
        </div>
      )}
    </div>
  );
}
