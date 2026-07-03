'use client';

import { useState } from 'react';
import { useRef } from 'react';
import { EGP, fmtDate, todayISO } from '@/lib/format';
import { PageTitle, Field, Combobox, MoneyInput, PlateInput, parsePlate, buildPlate, SearchInput } from '@/components/common';
import { useWarnOnLeave } from '@/lib/unsaved';
import { useAllParties } from '../../parties/hooks';
import { useDriverTrips, useCreateDriverTrip, useDeleteDriverTrip } from '../hooks';
import { useAllTreasury } from '../../treasury/hooks';
import { DriverTripDetail } from './DriverTripDetail';
import { DriversRegistry } from '../../drivers/components/DriversRegistry';
import type { DriverTrip } from '../dtos';

export function DriverTripsView() {
  const { data: trips, isLoading } = useDriverTrips();
  const { data: parties } = useAllParties('CLIENT');
  const { data: treasury } = useAllTreasury();
  const allTreasury = treasury?.data ?? [];
  const createTrip = useCreateDriverTrip();
  const deleteTrip = useDeleteDriverTrip();

  const [tab, setTab] = useState<'trips' | 'registry'>('trips');
  const [selected, setSelected] = useState<DriverTrip | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open');
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useWarnOnLeave(adding);

  const vehNumRef = useRef<HTMLInputElement>(null!);
  const trlNumRef = useRef<HTMLInputElement>(null!);

  // New trip form state
  const [driverName, setDriverName] = useState('');
  const [vehL, setVehL] = useState(['', '', '']);
  const [vehNumbers, setVehNumbers] = useState('');
  const [trlL, setTrlL] = useState(['', '', '']);
  const [trlNumbers, setTrlNumbers] = useState('');
  const [partyId, setPartyId] = useState('');
  const [departureDate, setDepartureDate] = useState(todayISO());
  const [agreedFreight, setAgreedFreight] = useState('');
  const [initialPaid, setInitialPaid] = useState('');
  const [initialPaidTreasuryId, setInitialPaidTreasuryId] = useState('');
  const [teaMoney, setTeaMoney] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const allClients = parties?.data ?? [];
  const selClient = allClients.find((c) => c.id === partyId);

  const resetForm = () => {
    setDriverName(''); setVehL(['', '', '']); setVehNumbers(''); setTrlL(['', '', '']); setTrlNumbers(''); setPartyId('');
    setDepartureDate(todayISO()); setAgreedFreight(''); setInitialPaid(''); setInitialPaidTreasuryId(''); setTeaMoney(''); setNote(''); setErr('');
    setAdding(false);
  };

  const saveNew = () => {
    setErr('');
    if (!driverName.trim()) return setErr('اكتب اسم السائق');
    if (!partyId) return setErr('اختر العميل');
    if (!agreedFreight || Number(agreedFreight) <= 0) return setErr('اكتب الناولون المتفق عليه');
    createTrip.mutate(
      {
        partyId,
        driverName: driverName.trim(),
        vehicleNo: buildPlate(vehL, vehNumbers),
        trailerNo: buildPlate(trlL, trlNumbers),
        clientName: selClient?.name ?? '',
        departureDate,
        agreedFreight: Number(agreedFreight),
        note: note.trim() || undefined,
        initialPaid: Number(initialPaid) || undefined,
        initialPaidTreasuryId: initialPaidTreasuryId || undefined,
        teaMoney: Number(teaMoney) || undefined,
      },
      { onSuccess: resetForm, onError: (e: any) => setErr(e.message) },
    );
  };

  const all = trips ?? [];
  // open = not arrived yet OR arrived but unpaid delay or weight diff
  const isOpen = (t: typeof all[0]) => !t.arrivalDate || (t.remainingDelay ?? 0) > 0 || (t.remainingWeightDiff ?? 0) > 0;
  const filtered = filter === 'all' ? all
    : filter === 'open'   ? all.filter(isOpen)
    : all.filter((t) => t.trulyClosed);

  const searched = filtered.filter((t) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!t.clientName.toLowerCase().includes(q) && !t.driverName.toLowerCase().includes(q)) return false;
    }
    if (dateFrom && t.departureDate.slice(0, 10) < dateFrom) return false;
    if (dateTo   && t.departureDate.slice(0, 10) > dateTo)   return false;
    return true;
  });

  if (selected) {
    const live = trips?.find((t) => t.id === selected.id) ?? selected;
    return <DriverTripDetail trip={live} onBack={() => setSelected(null)} />;
  }

  if (tab === 'registry') {
    return (
      <>
        <PageTitle title="كشف السائقين" subtitle="متابعة رحلات السائقين والمدفوعات وأيام العطلة" />
        <div className="toolbar" style={{ marginBottom: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setTab('trips')}>رحلات السائقين</button>
          <button className="btn btn-primary btn-sm">سجل السائقين</button>
        </div>
        <DriversRegistry />
      </>
    );
  }

  return (
    <>
      <PageTitle title="كشف السائقين" subtitle="متابعة رحلات السائقين والمدفوعات وأيام العطلة" />

      {/* Tab switcher */}
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm">رحلات السائقين</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setTab('registry')}>سجل السائقين</button>
      </div>

      {/* Toolbar */}
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <button className={`btn btn-sm ${adding ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => adding ? resetForm() : setAdding(true)}>
          {adding ? '× إلغاء' : '+ رحلة جديدة'}
        </button>
        {(['all', 'open', 'closed'] as const).map((f) => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f)}>
            {f === 'all' ? 'الكل' : f === 'open' ? 'مفتوحة' : 'مكتملة'}
          </button>
        ))}
      </div>

      {/* Search / filter bar */}
      <div className="toolbar" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="بحث باسم العميل أو السائق…" />
        <span className="muted" style={{ fontSize: 12 }}>من</span>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        <span className="muted" style={{ fontSize: 12 }}>إلى</span>
        <input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        {(search || dateFrom || dateTo) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}>× مسح</button>
        )}
      </div>

      {/* New trip form */}
      {adding && (
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <b style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>رحلة جديدة</b>
          <div className="form-grid">
            <Field label="اسم السائق">
              <input value={driverName} onChange={(e) => setDriverName(e.target.value)} />
            </Field>
            <Field label="رقم العربية (٣ حروف / أرقام)">
              <PlateInput letters={vehL} numbers={vehNumbers} onLettersChange={setVehL} onNumbersChange={setVehNumbers} numRef={vehNumRef} />
            </Field>
            <Field label="رقم المقطورة (٣ حروف / أرقام)">
              <PlateInput letters={trlL} numbers={trlNumbers} onLettersChange={setTrlL} onNumbersChange={setTrlNumbers} numRef={trlNumRef} />
            </Field>
            <Field label="العميل">
              <Combobox options={allClients} value={partyId} onChange={setPartyId} placeholder="اختر العميل…" />
            </Field>
            <Field label="تاريخ الطلوع">
              <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
            </Field>
            <Field label="الناولون المتفق عليه (ج.م)">
              <MoneyInput value={agreedFreight} onChange={setAgreedFreight} placeholder="0.00" />
            </Field>
            <Field label={`دفعة مقدمة (أقصى ${agreedFreight || '—'})`}>
              <MoneyInput
                value={initialPaid}
                onChange={(v) => {
                  const max = Number(agreedFreight) || Infinity;
                  setInitialPaid(Number(v) > max ? String(max) : v);
                }}
                placeholder="0.00"
              />
            </Field>
            {Number(initialPaid) > 0 && (
              <Field label="خزنة الدفعة المقدمة">
                <Combobox options={allTreasury} value={initialPaidTreasuryId} onChange={setInitialPaidTreasuryId} placeholder="اختياري…" />
              </Field>
            )}
            <Field label="شاي للسائق (اختياري)">
              <MoneyInput value={teaMoney} onChange={setTeaMoney} placeholder="0.00" />
            </Field>
            <Field label="ملاحظة">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري…" />
            </Field>
          </div>
          {err && <div className="err-text" style={{ marginTop: 8 }}>{err}</div>}
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={saveNew} disabled={createTrip.isPending}>
              {createTrip.isPending ? '...' : 'حفظ الرحلة'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={resetForm}>إلغاء</button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading && <div className="empty">جاري التحميل…</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {searched.map((trip) => {
          const remFreight   = trip.remainingFreight   ?? 0;
          const remDelay     = trip.remainingDelay    ?? 0;
          const remWeightDiff = trip.remainingWeightDiff ?? 0;
          const hasArrived   = !!trip.arrivalDate;
          const isTrulyClosed = trip.trulyClosed ?? false;
          const hasUnpaidDelay = hasArrived && remDelay > 0;
          const hasUnpaidWD    = hasArrived && remWeightDiff > 0;
          const borderColor = isTrulyClosed ? 'var(--credit)' : (hasUnpaidDelay || hasUnpaidWD) ? '#e67e00' : 'var(--debit)';
          return (
            <div
              key={trip.id}
              className="card"
              style={{ padding: 16, cursor: 'pointer', borderRight: `3px solid ${borderColor}` }}
              onClick={() => setSelected(trip)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{trip.driverName}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {trip.clientName}
                    {trip.vehicleNo ? ` — ${trip.vehicleNo}` : ''}
                    {trip.trailerNo ? ` / ${trip.trailerNo}` : ''}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    طلوع: {fmtDate(trip.departureDate)}
                    {hasArrived && ` — وصول: ${fmtDate(trip.arrivalDate!)}`}
                  </div>
                </div>
                <div style={{ textAlign: 'left', flexShrink: 0 }}>
                  <div className="muted" style={{ fontSize: 11 }}>الناولون</div>
                  <div className="num" style={{ fontWeight: 700 }}>{EGP(trip.agreedFreight)}</div>
                  {remFreight > 0 && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    متبقي: <span className="deb">{EGP(remFreight)}</span>
                  </div>}
                  {hasUnpaidDelay && <div style={{ fontSize: 11, color: '#e67e00', marginTop: 2, fontWeight: 700 }}>
                    عطلة: <span>{EGP(remDelay)}</span>
                  </div>}
                  {hasUnpaidWD && <div style={{ fontSize: 11, color: '#e67e00', marginTop: 2, fontWeight: 700 }}>
                    فرق وزن: <span>{EGP(remWeightDiff)}</span>
                  </div>}
                </div>
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: isTrulyClosed ? 'var(--credit-bg)' : 'var(--debit-bg)',
                  color: isTrulyClosed ? 'var(--credit)' : 'var(--debit)',
                  fontWeight: 700,
                }}>
                  {isTrulyClosed ? 'مكتملة' : hasArrived ? 'وصل' : 'جارية'}
                </span>
                {hasUnpaidDelay && (
                  <span style={{
                    fontSize: 11, padding: '2px 10px', borderRadius: 10,
                    background: '#fff3e0', color: '#e67e00', fontWeight: 700,
                    border: '1px solid #e67e00',
                  }}>
                    عطلة غير مدفوعة
                  </span>
                )}
                {hasUnpaidWD && (
                  <span style={{
                    fontSize: 11, padding: '2px 10px', borderRadius: 10,
                    background: '#fff3e0', color: '#e67e00', fontWeight: 700,
                    border: '1px solid #e67e00',
                  }}>
                    فرق وزن غير مدفوع
                  </span>
                )}
                {!hasArrived && (
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!window.confirm(`حذف رحلة "${trip.driverName}"؟`)) return;
                      deleteTrip.mutate(trip.id);
                    }}
                    disabled={deleteTrip.isPending}
                  >حذف</button>
                )}
              </div>
            </div>
          );
        })}
        {!isLoading && searched.length === 0 && <div className="empty">لا توجد رحلات</div>}
      </div>
    </>
  );
}
