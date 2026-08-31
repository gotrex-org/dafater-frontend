'use client';

import { useEffect, useRef, useState } from 'react';
import { todayISO, fmtDate } from '@/lib/format';
import { useNavigationGuard } from '@/lib/useNavigationGuard';
import { fieldNavKeyDown } from '@/lib/field-nav';
import { PageTitle, Field, Combobox, MoneyInput, PlateInput, parsePlate, buildPlate } from '@/components/common';
import { ProductCombobox } from '../../products/components/ProductCombobox';
import { PartyCombobox } from '../../invoices/components/PartyCombobox';
import { useAllProducts } from '../../products/hooks';
import { useAllParties } from '../../parties/hooks';
import { useInvoices } from '../../invoices/hooks';
import { useCreateManifest, useUpdateManifest } from '../hooks';
import { manifestsApi } from '../api';
import { DriverTripEditor } from '../../driver-trips/components/DriverTripEditor';
import { DriverCombo } from '../../drivers/components/DriverCombo';
import type { Manifest, ManifestItem } from '../dtos';
import type { DriverTrip } from '../../driver-trips/dtos';

const blankItem = (): ManifestItem => ({ name: '', qty: 0 });


interface Props {
  onClose: () => void;
  onCreated: (m: Manifest) => void;
  /** prefill (e.g. when starting a manifest from a just-saved invoice) */
  // invoiceId بيربط العربية بالفاتورة — من غيره العربية بتفضل كشف مستقل وماتظهرش
  // كتاب في الفاتورة (شوف ManifestTabs).
  initial?: { clientName?: string; items?: ManifestItem[]; note?: string; invoiceId?: string };
  /** when editing an existing manifest */
  manifest?: Manifest;
}

export function ManifestEditor({ onClose, onCreated, initial, manifest }: Props) {
  const isEdit = !!manifest;
  const createManifest = useCreateManifest();
  const updateManifest = useUpdateManifest();
  const { data: products } = useAllProducts();
  const { data: parties } = useAllParties('CLIENT');

  const vehParsed = parsePlate(manifest?.vehicleNo);
  const trlParsed = parsePlate(manifest?.trailerNo);

  const [no, setNo] = useState(manifest?.no ?? '');
  const [date, setDate] = useState(manifest?.date?.slice(0, 10) ?? todayISO());
  const [clientName, setClientName] = useState(manifest?.clientName ?? initial?.clientName ?? '');
  // الفاتورة المرتبطة — منها بتظهر العربية كتاب جوّه الفاتورة.
  const [invoiceId, setInvoiceId] = useState(manifest?.invoice?.id ?? initial?.invoiceId ?? '');
  // فواتير العميل المختار عشان قايمة الاختيار. البحث بيدوّر على اسم الطرف كمان.
  const { data: invoicesPage, isLoading: loadingInvoices } = useInvoices(
    clientName.trim() ? { search: clientName.trim(), pageSize: 200 } : {},
  );
  const clientInvoices = (invoicesPage?.data ?? []).filter((inv) => inv.party?.name === clientName.trim());

  // Auto-fill manifest number when clientName is set/changed (create mode only)
  useEffect(() => {
    if (!clientName.trim() || isEdit) return;
    manifestsApi.nextNo(clientName.trim()).then(({ no: n }) => setNo(n)).catch(() => {});
  }, [clientName, isEdit]);
  // partyId is only used to drive the combobox selection; clientName is the stored value
  const [partyId, setPartyId] = useState(() => {
    const existing = manifest?.clientName ?? initial?.clientName ?? '';
    return parties?.data?.find((p) => p.name === existing)?.id ?? '';
  });
  const [driverName, setDriverName] = useState(manifest?.driverName ?? '');
  const [driverNID, setDriverNID] = useState(manifest?.driverNID ?? '');
  const [driverPhone, setDriverPhone] = useState(manifest?.driverPhone ?? '');
  const [vehL, setVehL] = useState(vehParsed.letters);
  const [vehNumbers, setVehNumbers] = useState(vehParsed.numbers);
  // مسمّى العربية (عربية الزيتون / عربية ديدي) — بيتخزّن على الكشف والرحلة،
  // وبيظهر في بيان «عطلة عربية» على كشف حساب العميل
  const [vehicleLabel, setVehicleLabel] = useState(manifest?.vehicleLabel ?? '');
  const [trlL, setTrlL] = useState(trlParsed.letters);
  const [trlNumbers, setTrlNumbers] = useState(trlParsed.numbers);
  const [note, setNote] = useState(manifest?.note ?? initial?.note ?? '');
  const [items, setItems] = useState<ManifestItem[]>(
    manifest?.items.length
      ? manifest.items.map((it) => ({ name: it.name, qty: it.qty }))
      : initial?.items?.length
        ? initial.items.map((it) => ({ name: it.name, qty: it.qty }))
        : [blankItem()],
  );
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Manifest | null>(null);
  const [makeDriverTrip, setMakeDriverTrip] = useState(false);

  const setItem = (i: number, patch: Partial<ManifestItem>) =>
    setItems((its) => its.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const isDirty = isEdit || !!clientName || !!driverName || items.some((it) => !!(it.name || it.qty));
  useNavigationGuard(isDirty);
  const handleClose = () => {
    if (isDirty && !window.confirm('في بيانات لم تُحفظ — هل تريد المغادرة بدون حفظ؟')) return;
    onClose();
  };

  const save = () => {
    setError('');
    const goods = items.filter((it) => it.name.trim() && it.qty > 0);
    if (!clientName.trim()) return setError('اكتب اسم العميل');
    if (goods.length === 0) return setError('أضف صنفًا واحدًا على الأقل');

    const payload = {
      date,
      clientName: clientName.trim(),
      driverName: driverName.trim() || undefined,
      driverNID: driverNID.trim() || undefined,
      driverPhone: driverPhone.trim() || undefined,
      vehicleNo: buildPlate(vehL, vehNumbers),
      vehicleLabel: vehicleLabel.trim() || undefined,
      trailerNo: buildPlate(trlL, trlNumbers),
      note: note.trim() || undefined,
      items: goods.map((it) => ({ name: it.name.trim(), qty: Number(it.qty) || 0 })),
    };

    if (isEdit) {
      // سلسلة فاضية = فك الربط بالفاتورة (الباك بيفهمها كده) — عشان كده بنبعتها دايمًا.
      updateManifest.mutate(
        { id: manifest!.id, dto: { ...payload, invoiceId } },
        { onSuccess: onCreated, onError: (e: any) => setError(e.message) },
      );
    } else {
      createManifest.mutate(
        { ...payload, no: no.trim() || undefined, invoiceId: invoiceId || undefined },
        { onSuccess: (m) => setSaved(m), onError: (e: any) => setError(e.message) },
      );
    }
  };

  const vehNumRef = useRef<HTMLInputElement>(null!);
  const trlNumRef = useRef<HTMLInputElement>(null!);
  const isPending = isEdit ? updateManifest.isPending : createManifest.isPending;

  if (saved && makeDriverTrip) {
    return (
      <DriverTripEditor
        manifest={saved}
        onSaved={(_trip: DriverTrip) => onCreated(saved)}
        onSkip={() => onCreated(saved)}
      />
    );
  }

  if (saved) {
    return (
      <>
        <PageTitle title={`تم حفظ الكشف رقم ${saved.no} ✅`} />
        <div className="card" style={{ padding: 22 }}>
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>هل تريد تسجيله في كشف السائقين؟</p>
          <p className="muted" style={{ marginTop: -6 }}>سيتم نقل بيانات السائق والعربية والعميل تلقائيًا.</p>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button className="btn btn-primary" onClick={() => setMakeDriverTrip(true)}>نعم، سجّل في كشف السائقين</button>
            <button className="btn btn-ghost" onClick={() => onCreated(saved)}>لا، تم</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={handleClose}>→ رجوع لقائمة الكشوفات</button>
      <PageTitle
        title={isEdit ? `تعديل كشف رقم ${manifest?.no}` : 'كشف استلام جديد'}
        subtitle={isEdit ? undefined : 'كشف مستقل لاستلام وتوصيل البضاعة — غير مرتبط بفاتورة'}
      />
      <div className="card" onKeyDown={fieldNavKeyDown}>
        <div className="form-grid">
          {!isEdit && <Field label="رقم الكشف"><input value={no} onChange={(e) => setNo(e.target.value)} placeholder={clientName ? '…' : 'اختر العميل أولاً'} style={no ? { fontWeight: 700 } : {}} /></Field>}
          <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="اسم العميل" full>
            <PartyCombobox
              parties={parties?.data ?? []}
              value={partyId}
              onChange={(id, p) => {
                setPartyId(id);
                // `p` covers a client created right here, which isn't in the list yet
                const picked = p ?? (parties?.data ?? []).find((x) => x.id === id);
                if (picked) setClientName(picked.name);
              }}
              role="CLIENT"
            />
          </Field>
          {/* الربط بالفاتورة: هو اللي بيخلّي العربية تظهر كتاب جوّه الفاتورة بأصنافها
              ومصاريفها. بيتفعّل بعد اختيار العميل عشان نجيب فواتيره. */}
          <Field label="الفاتورة المرتبطة" full>
            <select
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              disabled={!clientName.trim() || loadingInvoices}
              style={{ width: '100%', padding: '11px 12px', border: '1.5px solid var(--line)', borderRadius: 10, background: '#fff' }}
            >
              <option value="">
                {!clientName.trim() ? 'اختر العميل أولاً' : loadingInvoices ? 'بيحمّل…' : 'كشف مستقل — مش مربوط بفاتورة'}
              </option>
              {clientInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  فاتورة {inv.kind === 'SALE' ? 'بيع' : 'شراء'} رقم {inv.no} — {fmtDate(inv.date)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="اسم السائق">
            <DriverCombo
              value={driverName}
              onChange={setDriverName}
              onSelect={(d) => {
                setDriverName(d.name);
                if (d.nationalId) setDriverNID(d.nationalId);
                if (d.phone) setDriverPhone(d.phone);
                const veh = parsePlate(d.vehicleNo ?? '');
                if (veh.letters.some(Boolean) || veh.numbers) { setVehL(veh.letters); setVehNumbers(veh.numbers); }
                if (d.vehicleLabel) setVehicleLabel(d.vehicleLabel);
                const trl = parsePlate(d.trailerNo ?? '');
                if (trl.letters.some(Boolean) || trl.numbers) { setTrlL(trl.letters); setTrlNumbers(trl.numbers); }
                if (d.note && !note) setNote(d.note);
              }}
            />
          </Field>
          <Field label="الرقم القومي للسائق"><input inputMode="numeric" value={driverNID} onChange={(e) => setDriverNID(e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="رقم تليفون السائق"><input inputMode="numeric" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="مسمّى العربية">
            <input value={vehicleLabel} onChange={(e) => setVehicleLabel(e.target.value)} placeholder="عربية الزيتون / عربية ديدي" />
          </Field>
          <Field label="رقم العربية (٣ حروف / أرقام)">
            <PlateInput letters={vehL} numbers={vehNumbers} onLettersChange={setVehL} onNumbersChange={setVehNumbers} numRef={vehNumRef} />
          </Field>
          <Field label="رقم المقطورة (٣ حروف / أرقام)">
            <PlateInput letters={trlL} numbers={trlNumbers} onLettersChange={setTrlL} onNumbersChange={setTrlNumbers} numRef={trlNumRef} />
          </Field>
          <Field label="ملاحظات (اختياري)" full><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>

        <div className="tbl-wrap combo-table">
          <table>
            <thead><tr><th>الصنف</th><th>الكمية</th><th></th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td style={{ minWidth: 240 }}>
                    <ProductCombobox
                      products={products?.data ?? []}
                      value={it.name}
                      onChange={(name) => setItem(i, { name })}
                      freeText
                    />
                  </td>
                  <td><MoneyInput value={String(it.qty || '')} onChange={(v) => setItem(i, { qty: Number(v) || 0 })} placeholder="0" style={{ width: 90 }} /></td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => setItems((its) => its.filter((_, idx) => idx !== i))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setItems((its) => [...its, blankItem()])}>+ إضافة صنف</button>
        </div>

        <div className="err-text" style={{ padding: '0 16px' }}>{error}</div>
        <div className="toolbar" style={{ padding: 16 }}>
          <button className="btn btn-primary" onClick={save} disabled={isPending}>
            {isPending ? '...' : isEdit ? 'حفظ التعديلات' : 'حفظ الكشف'}
          </button>
          <button className="btn btn-ghost" onClick={handleClose}>إلغاء</button>
        </div>
      </div>
    </>
  );
}
