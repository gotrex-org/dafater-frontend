'use client';

import { useRef, useState } from 'react';
import { Field, SearchInput, PlateInput, parsePlate, buildPlate } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useDrivers, useUpdateDriver, useDeleteDriver } from '../hooks';
import type { Driver } from '../dtos';

export function DriversRegistry() {
  const { can } = useAuth();
  const canManage = can('settings');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useDrivers();
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
        {drivers.map((d) => (
          <div key={d.id} className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{d.name}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {[d.nationalId && `ق: ${d.nationalId}`, d.phone, d.phone2, d.vehicleNo, d.trailerNo].filter(Boolean).join(' — ') || 'لا توجد بيانات إضافية'}
              </div>
              {d.note && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{d.note}</div>}
            </div>
            {canManage && (
              <div className="toolbar" style={{ flexShrink: 0 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(d)}>✏ تعديل</button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (!window.confirm(`حذف "${d.name}" من السجل؟`)) return;
                    deleteDriver.mutate(d.id);
                  }}
                  disabled={deleteDriver.isPending}
                >حذف</button>
              </div>
            )}
          </div>
        ))}
        {!isLoading && drivers.length === 0 && (
          <div className="empty">لا يوجد سائقين مسجلين</div>
        )}
      </div>
    </div>
  );
}
