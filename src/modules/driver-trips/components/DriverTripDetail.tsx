'use client';

import { useState, type ReactNode } from 'react';
import { EGP, fmtDate, todayISO } from '@/lib/format';
import { Field, Combobox, MoneyInput, PlateInput, parsePlate, buildPlate, Spinner, withCurrent } from '@/components/common';
import { PartyCombobox } from '../../invoices/components/PartyCombobox';
import { useAllParties } from '../../parties/hooks';
import { useAllTreasury } from '../../treasury/hooks';
import { useConfig } from '../../config/hooks';
import { useAddPayment, useDeletePayment, useDriverTrip, useLinkTripInvoice, useSetArrival, useTripInvoiceCandidates, useUpdateDriverTrip, useUpdateWeightDiff } from '../hooks';
import { useManifests, useVehicleShipping } from '../../manifests/hooks';
import { useDrivers } from '../../drivers/hooks';
import { RecordOpener } from '../../records/RecordOpener';
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

  // ربط الرحلة بكشف عربية. بنعرض كشوفات نفس العميل اللي عربيتها من عندنا بس —
  // كشف عربية مكتب العميل مالوش رحلة سائق (والباك إند بيرفضه كمان).
  const [linking, setLinking] = useState(false);
  const [linkErr, setLinkErr] = useState('');
  const { data: manifestsPage } = useManifests({ search: trip.clientName, pageSize: 100 });
  const linkableManifests = (manifestsPage?.data ?? []).filter(
    (m) => m.vehicleSource === 'OURS' && m.clientName === trip.clientName,
  );
  const updateWeightDiff = useUpdateWeightDiff();
  const { data: parties } = useAllParties('CLIENT');
  const { data: treasury } = useAllTreasury();
  const { data: config } = useConfig();
  const allTreasury = treasury?.data ?? [];
  const allClients = withCurrent(parties?.data ?? [], [trip.party]);
  const graceDays = config?.delayGraceDays ?? DELAY_THRESHOLD;
  const feeRate = config?.delayFeePerDay ?? DELAY_RATE;

  // ─── Edit form state ──────────────────────────────────────────────────────
  const [showEdit, setShowEdit]       = useState(false);
  const [editName, setEditName]       = useState(trip.driverName);
  const [editPartyId, setEditPartyId] = useState(trip.party?.id ?? '');
  const [editClientName, setEditClientName] = useState(trip.clientName);

  const vehParsed = parsePlate(trip.vehicleNo);
  const trlParsed = parsePlate(trip.trailerNo);
  const [editVehLabel, setEditVehLabel]   = useState(trip.vehicleLabel ?? '');
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
    setEditVehLabel(trip.vehicleLabel ?? '');
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
          vehicleLabel: editVehLabel.trim(),
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
  const wdPaid      = trip.payments.filter((p) => p.paymentType === 'weightDiff').reduce((s, p) => s + p.amount, 0);
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
    if (!payTreasuryId) return setPayErr('اختر الخزنة التي يخرج منها المبلغ');
    addPayment.mutate(
      { id: trip.id, dto: { date: payDate, amount: Number(payAmt), note: payNote || undefined, paymentType: payType, treasuryId: payTreasuryId || undefined } },
      {
        onSuccess: () => { setPayAmt(''); setPayNote(''); setPayTreasuryId(''); setShowPayForm(false); },
        onError: (e: any) => setPayErr(e.message),
      },
    );
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

  // ─── الشكل المبسّط: السائق ← البيانات والربط والوصول ← الناولون ← العطلة ──
  const [openRec, setOpenRec] = useState<{ entity: string; uid: string } | null>(null);
  const [pickingInvoice, setPickingInvoice] = useState(false);
  const [formAt, setFormAt] = useState<'freight' | 'delay' | 'wd'>('freight');
  const { data: driversPage } = useDrivers();
  const { data: shipping } = useVehicleShipping(trip.manifest?.uid ?? null);
  const driver = (driversPage?.data ?? []).find((d) => d.name.trim() === trip.driverName.trim());
  const phone = [driver?.phone, driver?.phone2].filter(Boolean).join(' — ');
  const customsTotal = shipping?.vehicleSource === 'OURS' ? shipping.customs.total : 0;
  const doc = trip.invoice ? { entity: 'invoices', uid: trip.invoice.id, label: `فاتورة ${trip.invoice.no}` }
    : trip.deal ? { entity: 'deals', uid: trip.deal.id, label: `بيع خارجي ${trip.deal.no}` } : null;

  if (openRec) return <RecordOpener entity={openRec.entity} uid={openRec.uid} onClose={() => setOpenRec(null)} />;

  const daysSoFar = daysBetween(trip.departureDate, todayISO());
  const freightPays = trip.payments.filter((p) => p.paymentType === 'freight' || p.paymentType === 'tea');
  const delayPays = trip.payments.filter((p) => p.paymentType === 'delay' || p.paymentType === 'advance');
  const wdPays = trip.payments.filter((p) => p.paymentType === 'weightDiff');
  const showDelay = isClosed || delayPays.length > 0;
  const totalRemaining = remaining + remainingDelay + remainingWD - advanceOver;

  const openPay = (t: typeof payType, at: typeof formAt) => { setPayType(t); setFormAt(at); setPayErr(''); setShowPayForm(true); };
  const startArrival = () => {
    setArrivalDate(isClosed ? trip.arrivalDate!.slice(0, 10) : todayISO());
    // تعديل تاريخ وصول رحلة مقفولة لازم يحافظ على فرق الوزن المسجّل
    setArrWeightDiff(weightDiffTotal > 0 ? String(weightDiffTotal) : '');
    setArrErr('');
    setShowArrival(true);
  };

  const typeLabel: Record<string, string> = { freight: 'ناولون', delay: 'عطلة', tea: 'شاي', weightDiff: 'فرق وزن', advance: 'سلفة' };
  const payRow = (p: DriverTrip['payments'][number]) => (
    <div key={p.id} className="tp-row">
      <span className="tp-d">{fmtDate(p.date)}</span>
      <span className="tp-t">
        {typeLabel[p.paymentType] ?? 'دفعة'}
        {p.paymentType === 'tea' && <span className="muted"> (لا يُخصم من الناولون)</span>}
        {p.paymentType === 'advance' && <span className="muted"> (تُخصم من العطلة)</span>}
        {p.note && <span className="muted"> · {p.note}</span>}
      </span>
      <span className="tp-m num">{EGP(p.amount)}</span>
      <button
        className="tp-x" aria-label="حذف الدفعة" disabled={deletePayment.isPending}
        onClick={() => { if (window.confirm('حذف هذه الدفعة؟')) deletePayment.mutate({ tripId: trip.id, payId: p.id }); }}
      >×</button>
    </div>
  );
  const sectionFoot = (actions: ReactNode, label: string, value: number) => (
    <div className="tp-foot">
      {actions}
      <span style={{ flex: 1 }} />
      <span className="muted">{label}&nbsp;</span>
      <b className="num" style={{ color: value > 0 ? 'var(--debit)' : 'var(--credit)', fontSize: 16 }}>{EGP(value)}</b>
    </div>
  );

  const payForm = showPayForm && (
    <div className="tp-form">
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="التاريخ"><input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} style={{ maxWidth: 160 }} /></Field>
        <Field label="النوع">
          <select value={payType} onChange={(e) => setPayType(e.target.value as any)} style={{ minWidth: 110 }}>
            <option value="freight">ناولون</option>
            {delayFee > 0 && <option value="delay">عطلة</option>}
            <option value="advance">سلفة</option>
            {weightDiffTotal > 0 && <option value="weightDiff">فرق وزن</option>}
          </select>
        </Field>
        <Field label="المبلغ (ج.م)"><MoneyInput value={payAmt} onChange={setPayAmt} placeholder="0.00" style={{ maxWidth: 130 }} /></Field>
        <Field label="الخزنة"><Combobox options={allTreasury} value={payTreasuryId} onChange={setPayTreasuryId} placeholder="اختر الخزنة…" /></Field>
        <Field label="ملاحظة"><input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="اختياري…" style={{ maxWidth: 180 }} /></Field>
      </div>
      {payErr && <div className="err-text" style={{ marginTop: 6 }}>{payErr}</div>}
      <div className="toolbar" style={{ marginTop: 10, marginBottom: 0 }}>
        <button className="btn btn-primary btn-sm" onClick={savePayment} disabled={addPayment.isPending}>{addPayment.isPending ? '...' : 'حفظ الدفعة'}</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setShowPayForm(false); setPayErr(''); }}>إلغاء</button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="toolbar no-print">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع</button>
        <span style={{ flex: 1 }} />
        {!showEdit && <button className="tp-link" onClick={openEdit}>تعديل</button>}
        <button className="tp-link" onClick={() => window.print()}>طباعة</button>
      </div>

      <div className="card tp-card">
        <div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{trip.driverName}</div>
          {phone && <div className="muted num" style={{ fontSize: 14.5 }}>{phone}</div>}
        </div>

        {showEdit ? (
          <div>
            <b style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>تعديل بيانات الرحلة</b>
            <div className="form-grid">
              <Field label="اسم السائق"><input value={editName} onChange={(e) => setEditName(e.target.value)} /></Field>
              <Field label="العميل (حساب)">
                <PartyCombobox parties={allClients} value={editPartyId} onChange={(id, p) => { setEditPartyId(id); setEditClientName(p?.name ?? allClients.find((c) => c.id === id)?.name ?? editClientName); }} role="CLIENT" />
              </Field>
              <Field label="مسمّى العربية"><input value={editVehLabel} onChange={(e) => setEditVehLabel(e.target.value)} placeholder="عربية الزيتون / عربية ديدي" /></Field>
              <Field label="رقم العربية">
                <PlateInput letters={editVehL} numbers={editVehNums} onLettersChange={setEditVehL} onNumbersChange={setEditVehNums} numRef={{ current: null } as any} />
              </Field>
              <Field label="رقم المقطورة">
                <PlateInput letters={editTrlL} numbers={editTrlNums} onLettersChange={setEditTrlL} onNumbersChange={setEditTrlNums} numRef={{ current: null } as any} />
              </Field>
              <Field label="تاريخ الطلوع"><input type="date" value={editDep} onChange={(e) => setEditDep(e.target.value)} /></Field>
              <Field label="الناولون المتفق عليه (ج.م)"><MoneyInput value={editFreight} onChange={setEditFreight} placeholder="0.00" /></Field>
              <Field label="ملاحظة" full><input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="اختياري…" /></Field>
            </div>
            {editErr && <div className="err-text" style={{ marginTop: 8 }}>{editErr}</div>}
            <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
              <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={updateTrip.isPending}>{updateTrip.isPending ? '...' : 'حفظ التعديلات'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowEdit(false); setEditErr(''); }}>إلغاء</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="tp-info">
              <b>العربية</b>
              <span>
                {[trip.vehicleLabel, trip.vehicleNo].filter(Boolean).join(' · ') || '—'}
                {trip.trailerNo && <span className="muted" style={{ fontWeight: 400 }}> · مقطورة {trip.trailerNo}</span>}
              </span>
            </div>
            <div className="tp-info"><b>العميل</b><span>{trip.clientName}</span></div>

            {/* الربط: كشف العربية والفاتورة — الضغط بيفتح المستند، و«تغيير» بيربط غيره */}
            <div className="tp-info">
              <b>مربوطة بـ</b>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {trip.manifest
                  ? <button className="tp-doc" onClick={() => setOpenRec({ entity: 'manifests', uid: trip.manifest!.uid })}>كشف العربية #{trip.manifest.no}</button>
                  : <span className="muted" style={{ fontWeight: 400 }}>بدون كشف</span>}
                <button className="tp-small" onClick={() => { setLinking((v) => !v); setLinkErr(''); }}>{linking ? 'إلغاء' : trip.manifest ? 'تغيير' : 'ربط'}</button>
                <span className="muted">·</span>
                {doc
                  ? <button className="tp-doc" onClick={() => setOpenRec({ entity: doc.entity, uid: doc.uid })}>{doc.label}</button>
                  : <span className="muted" style={{ fontWeight: 400 }}>بدون فاتورة</span>}
                <button className="tp-small" onClick={() => setPickingInvoice((v) => !v)}>{pickingInvoice ? 'إلغاء' : doc ? 'تغيير' : 'ربط'}</button>
              </span>
            </div>
            {linking && (
              <div style={{ padding: '6px 0 10px', maxWidth: 360 }}>
                <select
                  value={trip.manifest?.uid ?? ''}
                  disabled={updateTrip.isPending}
                  onChange={(e) => {
                    setLinkErr('');
                    updateTrip.mutate(
                      { id: trip.id, dto: { manifestId: e.target.value } },
                      { onSuccess: () => setLinking(false), onError: (err: any) => setLinkErr(err?.message || 'تعذر الربط') },
                    );
                  }}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--line)', borderRadius: 9, background: '#fff', fontSize: 13 }}
                >
                  <option value="">بدون كشف</option>
                  {linkableManifests.map((m) => (
                    <option key={m.id} value={m.id}>كشف {m.no} — {fmtDate(m.date)}{m.clientName ? ` — ${m.clientName}` : ''}</option>
                  ))}
                </select>
                {linkableManifests.length === 0 && (
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>لا توجد كشوفات متاحة لـ {trip.clientName}. كشوفات مكتب الشحن ليس لها رحلة سائق.</div>
                )}
                {linkErr && <div className="err-text" style={{ fontSize: 12 }}>{linkErr}</div>}
              </div>
            )}
            {pickingInvoice && <InvoicePicker trip={trip} onDone={() => setPickingInvoice(false)} />}

            {customsTotal > 0 && (
              <div className="tp-info">
                <b>الجمرك</b>
                <span className="num">
                  {EGP(customsTotal)}
                  <span className="muted" style={{ fontWeight: 400 }}> · {[...new Set(shipping!.customs.lines.map((l) => l.office?.name).filter(Boolean))].join('، ')}</span>
                </span>
              </div>
            )}
            {trip.note && <div className="tp-info"><b>ملاحظة</b><span style={{ fontWeight: 400 }}>{trip.note}</span></div>}

            {/* الرحلة: الطلوع والوصول في سطر واحد، وجنبه اختيار التاريخ */}
            <div className="tp-info" style={{ borderBottom: 'none', flexWrap: 'wrap', rowGap: 6 }}>
              <b>الرحلة</b>
              <span>
                طلوع {fmtDate(trip.departureDate)}
                {isClosed
                  ? <span className="muted" style={{ fontWeight: 400 }}> · وصول {fmtDate(trip.arrivalDate!)} · {days} يوم</span>
                  : <span style={{ fontWeight: 400, color: 'var(--debit)' }}> · في الطريق {daysSoFar} يوم</span>}
              </span>
              {(!isClosed || showArrival) ? (
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="date" aria-label="تاريخ الوصول"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                    style={{ padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }}
                  />
                  <button
                    className="btn btn-sm" style={{ background: 'var(--ink)', color: '#fff' }} disabled={setArrival.isPending}
                    onClick={saveArrival}
                  >{setArrival.isPending ? '...' : isClosed ? 'حفظ' : 'تسجيل وصول'}</button>
                  {showArrival && isClosed && <button className="tp-small" onClick={() => { setShowArrival(false); setArrErr(''); }}>إلغاء</button>}
                </span>
              ) : (
                <button className="tp-small" onClick={startArrival}>تعديل الوصول</button>
              )}
            </div>
            {arrErr && <div className="err-text">{arrErr}</div>}
          </div>
        )}

        {/* الناولون ودفعاته */}
        <div>
          <div className="tp-head"><span>الناولون</span><b className="num" style={{ fontSize: 22 }}>{EGP(trip.agreedFreight)}</b></div>
          {freightPays.length === 0 && <div className="muted" style={{ fontSize: 13.5, padding: '6px 0' }}>لا توجد دفعات بعد</div>}
          {freightPays.map(payRow)}
          {showPayForm && formAt === 'freight' && payForm}
          {sectionFoot(!showPayForm && <button className="tp-add" onClick={() => openPay('freight', 'freight')}>+ دفعة</button>, 'المتبقي', remaining)}
        </div>

        {/* العطلة في الآخر — بعد تسجيل الوصول، والسلفة بتتخصم منها */}
        {showDelay && (
          <div>
            <div className="tp-head"><span>العطلة</span><b className="num" style={{ fontSize: 18 }}>{EGP(delayFee)}</b></div>
            {isClosed && (
              <div className="muted" style={{ fontSize: 13.5, paddingBottom: 4 }}>
                {delayDays > 0 ? `${delayDays} يوم بعد ${graceDays} أيام سماح × ${EGP(feeRate)}` : 'الرحلة في المعاد — لا توجد عطلة'}
                {delayFee > 0 && (trip.party ? ` · مرحّلة على حساب ${trip.party.name}` : ' · لم تُرحَّل: لا يوجد حساب مرتبط')}
              </div>
            )}
            {delayPays.map(payRow)}
            {showPayForm && formAt === 'delay' && showDelay && payForm}
            {sectionFoot(
              !showPayForm && (
                <span style={{ display: 'flex', gap: 14 }}>
                  {delayFee > 0 && <button className="tp-add" onClick={() => openPay('delay', 'delay')}>+ دفعة عطلة</button>}
                  <button className="tp-add" onClick={() => openPay('advance', 'delay')}>+ سلفة</button>
                </span>
              ),
              advanceOver > 0 ? 'سلفة زيادة على السائق' : 'المتبقي',
              advanceOver > 0 ? advanceOver : remainingDelay,
            )}
          </div>
        )}
        {!showDelay && !showPayForm && (
          <button className="tp-add" style={{ alignSelf: 'flex-start' }} onClick={() => openPay('advance', 'delay')}>+ سلفة للسائق</button>
        )}
        {showPayForm && formAt === 'delay' && !showDelay && payForm}

        {/* فرق الوزن — بعد الوصول بس */}
        {isClosed && (weightDiffTotal > 0 || showEditWD) && (
          <div>
            <div className="tp-head"><span>فرق الوزن</span><b className="num" style={{ fontSize: 18 }}>{EGP(weightDiffTotal)}</b></div>
            {wdPays.map(payRow)}
            {showPayForm && formAt === 'wd' && payForm}
            {showEditWD && (
              <div className="tp-form" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label={`فرق وزن جديد (كان ${EGP(weightDiffTotal)})`}>
                  <MoneyInput value={editWDAmount} onChange={setEditWDAmount} placeholder="0.00" style={{ maxWidth: 140 }} />
                </Field>
                <button
                  className="btn btn-primary btn-sm" disabled={updateWeightDiff.isPending}
                  onClick={() => {
                    setEditWDErr('');
                    const newAmt = Number(editWDAmount);
                    if (isNaN(newAmt) || newAmt < 0) return setEditWDErr('مبلغ غير صحيح');
                    updateWeightDiff.mutate(
                      { id: trip.id, amount: newAmt },
                      { onSuccess: () => { setShowEditWD(false); setEditWDAmount(''); }, onError: (e: any) => setEditWDErr(e.message) },
                    );
                  }}
                >{updateWeightDiff.isPending ? '...' : 'حفظ'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowEditWD(false); setEditWDErr(''); }}>إلغاء</button>
                {editWDErr && <div className="err-text" style={{ fontSize: 12 }}>{editWDErr}</div>}
              </div>
            )}
            {sectionFoot(
              !showPayForm && !showEditWD && (
                <span style={{ display: 'flex', gap: 14 }}>
                  {weightDiffTotal > 0 && <button className="tp-add" onClick={() => openPay('weightDiff', 'wd')}>+ دفعة</button>}
                  <button className="tp-add" onClick={() => { setEditWDAmount(String(weightDiffTotal)); setEditWDErr(''); setShowEditWD(true); }}>تعديل المبلغ</button>
                </span>
              ),
              'المتبقي', remainingWD,
            )}
          </div>
        )}
        {isClosed && weightDiffTotal === 0 && !showEditWD && (
          <button className="tp-add" style={{ alignSelf: 'flex-start' }} onClick={() => { setEditWDAmount(''); setEditWDErr(''); setShowEditWD(true); }}>+ فرق وزن</button>
        )}

        <div className="tp-total">
          <span>المتبقي للسائق</span>
          <b className="num" style={{ color: totalRemaining > 0 ? 'var(--debit)' : 'var(--credit)' }}>{EGP(totalRemaining)}</b>
        </div>
      </div>
    </div>
  );
}

/** يفتح رحلة سائق بالـ uid — بيستخدمه شريط السلسلة و RecordOpener. */
export function DriverTripDetailById({ uid, onBack }: { uid: string; onBack: () => void }) {
  const { data, isLoading } = useDriverTrip(uid);
  if (isLoading || !data) return <Spinner />;
  return <DriverTripDetail trip={data} onBack={onBack} />;
}

// ربط الرحلة بفاتورة بيع أو عملية بيع خارجي — رحلة واحدة = مستند واحد. بيظهر لما
// تدوس «ربط» أو «تغيير» جنب الفاتورة في سطر «مربوطة بـ».
function InvoicePicker({ trip, onDone }: { trip: DriverTrip; onDone: () => void }) {
  const { data: candidates, isLoading } = useTripInvoiceCandidates(trip.id, true);
  const link = useLinkTripInvoice();
  const linked = !!(trip.invoice ?? trip.deal);

  const choose = (invoiceId: string | null, type: 'invoice' | 'deal' = 'invoice') =>
    link.mutate({ id: trip.id, invoiceId, type }, { onSuccess: onDone });

  return (
    <div className="tp-form" style={{ margin: '6px 0 10px' }}>
      {isLoading ? <Spinner /> : !candidates?.length ? (
        <div className="muted" style={{ fontSize: 13 }}>لا توجد فواتير بيع أو عمليات بيع خارجي بدون ربط لـ {trip.clientName}</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>المستند</th><th>التاريخ</th><th>البنود</th><th style={{ width: 80 }}></th></tr></thead>
            <tbody>
              {candidates.map((c) => {
                const isCurrent = (c.type === 'deal' ? trip.deal?.id : trip.invoice?.id) === c.id;
                return (
                  <tr key={`${c.type ?? 'invoice'}:${c.id}`}>
                    <td><b>{c.type === 'deal' ? 'بيع خارجي ' : 'فاتورة '}{c.no}</b></td>
                    <td>{fmtDate(c.date)}</td>
                    <td className="muted">{[...(c.charges ?? []).map((x) => x.chargeType?.name ?? '—'), ...c.items.map((it) => it.product?.name ?? '—')].join('، ')}</td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => choose(c.id, c.type ?? 'invoice')} disabled={link.isPending || isCurrent}>
                        {isCurrent ? 'مربوطة' : 'ربط'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {linked && (
        <button className="tp-small" style={{ marginTop: 8, color: 'var(--debit)' }} onClick={() => choose(null)} disabled={link.isPending}>فك ربط الفاتورة</button>
      )}
      {link.error && <div className="err-text" style={{ marginTop: 8 }}>{(link.error as any).message}</div>}
    </div>
  );
}
