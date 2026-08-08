'use client';

import { useRef, useState } from 'react';
import { Field, SearchInput, PlateInput, parsePlate, buildPlate, Combobox, MoneyInput } from '@/components/common';
import { EGP, todayISO } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useAllTreasury } from '../../treasury/hooks';
import { useDrivers, useUpdateDriver, useDeleteDriver, useCreateDriverAdvance, useDriverAdvances, useDeleteDriverAdvance } from '../hooks';
import type { Driver } from '../dtos';

// لوحة سلف السائق: صرف سلفة (كاش من خزنة) + قائمة السلف. العطلات بتسدّد السلفة تلقائيًا في الملخص.
function DriverAdvancePanel({ driverName, treasuryOptions, canManage }: { driverName: string; treasuryOptions: { id: string; name: string }[]; canManage: boolean }) {
  const create = useCreateDriverAdvance();
  const del = useDeleteDriverAdvance();
  const { data: advances } = useDriverAdvances(driverName);
  const [amount, setAmount] = useState('');
  const [treasuryId, setTreasuryId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const save = () => {
    setErr('');
    if (!amount || Number(amount) <= 0) return setErr('اكتب المبلغ');
    if (!treasuryId) return setErr('اختر الخزنة');
    create.mutate(
      { driverName, date, amount: Number(amount), treasuryId, note: note.trim() || undefined },
      { onSuccess: () => { setAmount(''); setNote(''); }, onError: (e: any) => setErr(e.message) },
    );
  };

  return (
    <div style={{ marginTop: 10, borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
      {canManage && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="مبلغ السلفة"><MoneyInput value={amount} onChange={setAmount} placeholder="0.00" style={{ maxWidth: 120 }} /></Field>
          <Field label="من خزنة"><div style={{ minWidth: 150 }}><Combobox options={treasuryOptions} value={treasuryId} onChange={setTreasuryId} placeholder="اختر الخزنة" /></div></Field>
          <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="بيان"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" style={{ maxWidth: 140 }} /></Field>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={create.isPending}>+ صرف سلفة</button>
        </div>
      )}
      {err && <div className="err-text" style={{ marginTop: 6 }}>{err}</div>}
      {(advances?.length ?? 0) > 0 && (
        <div className="tbl-wrap" style={{ marginTop: 8 }}>
          <table style={{ fontSize: 13 }}>
            <thead><tr><th>التاريخ</th><th>المبلغ</th><th>بيان</th><th></th></tr></thead>
            <tbody>
              {advances!.map((a) => (
                <tr key={a.id}>
                  <td className="muted">{new Date(a.date).toLocaleDateString('en-CA')}</td>
                  <td className="num deb">{EGP(a.amount)}</td>
                  <td className="muted">{a.note || '—'}</td>
                  <td>{canManage && <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('حذف السلفة؟ هيرجّع الكاش للخزنة.')) del.mutate(a.id); }} disabled={del.isPending}>حذف</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function DriversRegistry() {
  const { can } = useAuth();
  const canManage = can('settings');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useDrivers();
  const { data: treasury } = useAllTreasury();
  const [openAdvance, setOpenAdvance] = useState<string | null>(null);
  const updateDriver = useUpdateDriver();
  const deleteDriver = useDeleteDriver();

  const [editing, setEditing] = useState<Driver | null>(null);
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
  const [vehL, setVehL] = useState<string[]>(['', '', '']);
  const [vehNumbers, setVehNumbers] = useState('');
  const [trlL, setTrlL] = useState<string[]>(['', '', '']);
  const [trlNumbers, setTrlNumbers] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const vehNumRef = useRef<HTMLInputElement>(null!);
  const trlNumRef = useRef<HTMLInputElement>(null!);

  const drivers = (data?.data ?? []).filter((d) =>
    !search.trim() || d.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const openEdit = (d: Driver) => {
    setEditing(d);
    setNationalId(d.nationalId ?? '');
    setPhone(d.phone ?? '');
    setPhone2(d.phone2 ?? '');
    const veh = parsePlate(d.vehicleNo ?? '');
    setVehL(veh.letters);
    setVehNumbers(veh.numbers);
    const trl = parsePlate(d.trailerNo ?? '');
    setTrlL(trl.letters);
    setTrlNumbers(trl.numbers);
    setNote(d.note ?? '');
    setErr('');
  };

  const saveEdit = () => {
    if (!editing) return;
    setErr('');
    updateDriver.mutate(
      {
        id: editing.id,
        dto: {
          nationalId: nationalId.trim() || undefined,
          phone: phone.trim() || undefined,
          phone2: phone2.trim() || undefined,
          vehicleNo: buildPlate(vehL, vehNumbers),
          trailerNo: buildPlate(trlL, trlNumbers),
          note: note.trim() || undefined,
        },
      },
      { onSuccess: () => setEditing(null), onError: (e: any) => setErr(e.message) },
    );
  };

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="بحث باسم السائق…" />
        <span className="muted" style={{ fontSize: 12 }}>{drivers.length} سائق</span>
      </div>

      {isLoading && <div className="empty">جاري التحميل…</div>}

      {/* Edit drawer */}
      {editing && canManage && (
        <div className="card" style={{ padding: 18, marginBottom: 16, borderRight: '3px solid var(--primary)' }}>
          <b style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>تعديل بيانات: {editing.name}</b>
          <div className="form-grid">
            <Field label="الرقم القومي">
              <input inputMode="numeric" value={nationalId} onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))} placeholder="اختياري…" />
            </Field>
            <Field label="رقم الهاتف">
              <input inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="اختياري…" />
            </Field>
            <Field label="رقم هاتف ثانٍ">
              <input inputMode="numeric" value={phone2} onChange={(e) => setPhone2(e.target.value)} placeholder="اختياري…" />
            </Field>
            <Field label="رقم العربية (٣ حروف / أرقام)">
              <PlateInput letters={vehL} numbers={vehNumbers} onLettersChange={setVehL} onNumbersChange={setVehNumbers} numRef={vehNumRef} />
            </Field>
            <Field label="رقم المقطورة (٣ حروف / أرقام)">
              <PlateInput letters={trlL} numbers={trlNumbers} onLettersChange={setTrlL} onNumbersChange={setTrlNumbers} numRef={trlNumRef} />
            </Field>
            <Field label="ملاحظة">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري…" />
            </Field>
          </div>
          {err && <div className="err-text" style={{ marginTop: 8 }}>{err}</div>}
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={updateDriver.isPending}>
              {updateDriver.isPending ? '...' : 'حفظ'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>إلغاء</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {drivers.map((d) => {
          const totalAdvance = d.totalAdvance ?? 0;
          const delayEarned = d.delayEarned ?? 0;
          const outstanding = d.outstandingAdvance ?? Math.max(0, totalAdvance - delayEarned);
          const hasMoney = totalAdvance > 0 || delayEarned > 0;
          const advOpen = openAdvance === d.name;
          return (
          <div key={d.id} className="card" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{d.name}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {[d.nationalId && `ق: ${d.nationalId}`, d.phone, d.phone2, d.vehicleNo, d.trailerNo].filter(Boolean).join(' — ') || 'لا توجد بيانات إضافية'}
                </div>
                {d.note && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{d.note}</div>}
              </div>
              <div className="toolbar" style={{ flexShrink: 0 }}>
                <button className={`btn btn-sm ${advOpen ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setOpenAdvance(advOpen ? null : d.name)}>💰 السلف</button>
                {canManage && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(d)}>✏ تعديل</button>}
                {canManage && (
                  <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm(`حذف "${d.name}" من السجل؟`)) deleteDriver.mutate(d.id); }} disabled={deleteDriver.isPending}>حذف</button>
                )}
              </div>
            </div>

            {hasMoney && (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 12.5, fontWeight: 700 }}>
                <span>سلفة مصروفة: <span className="num deb">{EGP(totalAdvance)}</span></span>
                <span>عطلات مكتسبة: <span className="num cre">{EGP(delayEarned)}</span></span>
                <span>متبقي السلفة على السائق: <span className={`num ${outstanding > 0 ? 'deb' : 'cre'}`}>{EGP(outstanding)}</span></span>
              </div>
            )}

            {advOpen && <DriverAdvancePanel driverName={d.name} treasuryOptions={treasury?.data ?? []} canManage={canManage} />}
          </div>
          );
        })}
        {!isLoading && drivers.length === 0 && (
          <div className="empty">لا يوجد سائقين مسجلين</div>
        )}
      </div>
    </div>
  );
}
