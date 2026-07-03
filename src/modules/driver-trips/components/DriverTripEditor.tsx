'use client';

import { useRef, useState } from 'react';
import { todayISO } from '@/lib/format';
import { Field, Combobox, MoneyInput, PageTitle, PlateInput, parsePlate, buildPlate } from '@/components/common';
import { useAllParties } from '../../parties/hooks';
import { useAllTreasury } from '../../treasury/hooks';
import { useCreateDriverTrip } from '../hooks';
import { DriverCombo } from '../../drivers/components/DriverCombo';
import type { DriverTrip } from '../dtos';
import type { Manifest } from '../../manifests/dtos';

interface Props {
  manifest: Manifest;
  onSaved: (trip: DriverTrip) => void;
  onSkip: () => void;
}

export function DriverTripEditor({ manifest, onSaved, onSkip }: Props) {
  const { data: parties } = useAllParties('CLIENT');
  const { data: treasury } = useAllTreasury();
  const create = useCreateDriverTrip();

  const allClients = parties?.data ?? [];

  const vehParsed = parsePlate(manifest.vehicleNo);
  const trlParsed = parsePlate(manifest.trailerNo);

  const [driverName, setDriverName] = useState(manifest.driverName ?? '');
  const [partyId, setPartyId] = useState(() =>
    allClients.find((p) => p.name === manifest.clientName)?.id ?? ''
  );
  const [vehL, setVehL] = useState(vehParsed.letters);
  const [vehNumbers, setVehNumbers] = useState(vehParsed.numbers);
  const [trlL, setTrlL] = useState(trlParsed.letters);
  const [trlNumbers, setTrlNumbers] = useState(trlParsed.numbers);
  const vehNumRef = useRef<HTMLInputElement>(null!);
  const trlNumRef = useRef<HTMLInputElement>(null!);

  const [departureDate, setDepartureDate] = useState(manifest.date?.slice(0, 10) ?? todayISO());
  const [agreedFreight, setAgreedFreight] = useState('');
  const [initialPaid, setInitialPaid] = useState('');
  const [initialPaidTreasuryId, setInitialPaidTreasuryId] = useState('');
  const [teaMoney, setTeaMoney] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const save = () => {
    setErr('');
    if (!driverName.trim()) return setErr('اكتب اسم السائق');
    if (!partyId) return setErr('اختر العميل');
    if (!agreedFreight || Number(agreedFreight) <= 0) return setErr('اكتب الناولون المتفق عليه');
    create.mutate(
      {
        manifestId: manifest.id,
        partyId,
        driverName: driverName.trim(),
        vehicleNo: buildPlate(vehL, vehNumbers),
        trailerNo: buildPlate(trlL, trlNumbers),
        departureDate,
        agreedFreight: Number(agreedFreight),
        note: note.trim() || undefined,
        initialPaid: Number(initialPaid) || undefined,
        initialPaidTreasuryId: initialPaidTreasuryId || undefined,
        teaMoney: Number(teaMoney) || undefined,
      },
      {
        onSuccess: onSaved,
        onError: (e: any) => setErr(e.message),
      },
    );
  };

  return (
    <>
      <PageTitle title="تسجيل في كشف السائقين" subtitle={`كشف رقم ${manifest.no} — ${manifest.clientName}`} />
      <div className="card" style={{ padding: 20 }}>
        <div className="form-grid">
          <Field label="اسم السائق">
            <DriverCombo
              value={driverName}
              onChange={setDriverName}
              onSelect={(d) => {
                setDriverName(d.name);
                const veh = parsePlate(d.vehicleNo ?? '');
                if (veh.letters.some(Boolean) || veh.numbers) { setVehL(veh.letters); setVehNumbers(veh.numbers); }
                const trl = parsePlate(d.trailerNo ?? '');
                if (trl.letters.some(Boolean) || trl.numbers) { setTrlL(trl.letters); setTrlNumbers(trl.numbers); }
                if (d.note && !note) setNote(d.note);
              }}
            />
          </Field>
          <Field label="العميل">
            <Combobox options={allClients} value={partyId} onChange={setPartyId} placeholder="اختر العميل…" />
          </Field>
          <Field label="رقم العربية (٣ حروف / أرقام)">
            <PlateInput letters={vehL} numbers={vehNumbers} onLettersChange={setVehL} onNumbersChange={setVehNumbers} numRef={vehNumRef} />
          </Field>
          <Field label="رقم المقطورة (٣ حروف / أرقام)">
            <PlateInput letters={trlL} numbers={trlNumbers} onLettersChange={setTrlL} onNumbersChange={setTrlNumbers} numRef={trlNumRef} />
          </Field>
          <Field label="تاريخ الطلوع">
            <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
          </Field>
          <Field label="الناولون المتفق عليه (ج.م)">
            <MoneyInput value={agreedFreight} onChange={setAgreedFreight} placeholder="0.00" />
          </Field>
          <Field label={`دفعة مقدمة للسائق (أقصى ${agreedFreight || '—'})`}>
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
            <Field label="خزينة الدفعة الأولى">
              <Combobox options={treasury?.data ?? []} value={initialPaidTreasuryId} onChange={setInitialPaidTreasuryId} placeholder="اختياري…" />
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
          <button className="btn btn-primary" onClick={save} disabled={create.isPending}>
            {create.isPending ? '...' : 'حفظ في كشف السائقين'}
          </button>
          <button className="btn btn-ghost" onClick={onSkip}>تخطي</button>
        </div>
      </div>
    </>
  );
}
