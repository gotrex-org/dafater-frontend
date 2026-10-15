'use client';

import { useState } from 'react';
import { Combobox, Field, MoneyInput } from '@/components/common';
import { useAllParties } from '../../parties/hooks';
import { useUsers } from '../../users/hooks';
import { useDeletePartner, useUpdatePartner } from '../hooks';
import type { Partner, ShareBasis } from '../dtos';
import { CapitalPanel } from './CapitalPanel';

const selectStyle = {
  width: '100%', padding: '11px 12px', border: '1.5px solid var(--line)',
  borderRadius: 10, background: 'var(--surface)', fontSize: 14,
};

/** خانة اختيارية: علامة صح تفتح الحقل، وإزالتها تخفيه وتلغي قيمته. */
function Toggle(
  { on, onChange, label, children }:
  { on: boolean; onChange: (v: boolean) => void; label: string; children?: React.ReactNode },
) {
  return (
    <div className="field full" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {on && children && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

/**
 * إعدادات التصفية لكل اسم: الاسم وطريقة التصفية، وباقي الإعدادات اختيارية —
 * الحقل الذي لم يتم تفعيله لا يظهر في النموذج ولا في بطاقة الاسم.
 *
 * برأس المال: يُكتب رأس المال هنا، وتُضاف أو تُنقص الحركات من قسم رأس المال.
 * تصفية ثابتة: لا يظهر خيار آخر، لأن المبلغ للوحدة يُكتب لكل فاتورة شراء.
 *
 * الحساب في كل الأحوال على أصناف المورد المحدد.
 */
export function SettlementSettings({ partner }: { partner: Partner }) {
  const { data: suppliers } = useAllParties('SUPPLIER');
  const { data: users } = useUsers({ all: true });
  const update = useUpdatePartner();
  const del = useDeletePartner();

  const [name, setName] = useState(partner.name);
  const [basis, setBasis] = useState<ShareBasis>(partner.shareBasis);
  const [capital, setCapital] = useState(String(partner.capital || ''));

  // الخانات الاختيارية: مفعّلة إذا كانت لها قيمة محفوظة
  const [useSupplier, setUseSupplier] = useState(partner.suppliers.length > 0);
  const [supplierId, setSupplierId] = useState(partner.suppliers[0]?.id ?? '');
  const [useCarton, setUseCarton] = useState(partner.cartonExpense > 0);
  const [carton, setCarton] = useState(String(partner.cartonExpense || ''));
  const [useUser, setUseUser] = useState(!!partner.user);
  const [userId, setUserId] = useState(partner.user?.id ?? '');

  const [note, setNote] = useState(partner.note ?? '');
  const [active, setActive] = useState(partner.active);
  const [error, setError] = useState('');

  const busy = update.isPending || del.isPending;
  const who = name.trim() || 'الاسم';
  const userOptions = (users?.data ?? [])
    .filter((u) => !u.admin)
    .map((u) => ({ id: u.id, name: u.username ? `${u.name} (${u.username})` : u.name }));

  const save = () => {
    if (!name.trim()) return setError('اكتب الاسم');
    setError('');
    update.mutate(
      {
        id: partner.id,
        dto: {
          name: name.trim(),
          shareBasis: basis,
          // نرسل حقل الطريقة المختارة فقط. تصفير الآخر كان يمحو رأس المال
          // عند التحويل إلى التصفية الثابتة ثم الرجوع، بلا أي تنبيه.
          ...(basis === 'CAPITAL' ? { capital: Number(capital) || 0 } : {}),
          supplierIds: useSupplier && supplierId ? [supplierId] : [],
          cartonExpense: useCarton ? Number(carton) || 0 : 0,
          userId: useUser && userId ? userId : null,
          note: note || undefined,
          active,
        },
      },
      { onError: (e: any) => setError(e.message) },
    );
  };

  const remove = () => {
    const ok = window.confirm(
      `حذف «${partner.name}» من التصفية؟ سيتم حذف الفواتير المحددة له وحركات رأس ماله، وقوائم أسعار الموردين تبقى كما هي.`,
    );
    if (!ok) return;
    del.mutate(partner.id, { onError: (e: any) => setError(e.message) });
  };

  return (
    <>
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <b style={{ display: 'block', marginBottom: 10 }}>إعدادات {partner.name}</b>

      <div className="form-grid">
        <Field label="الاسم">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الشخص" />
        </Field>

        <Field label="طريقة التصفية">
          <select value={basis} onChange={(e) => setBasis(e.target.value as ShareBasis)} style={selectStyle}>
            <option value="CAPITAL">برأس المال</option>
            <option value="FIXED">تصفية ثابتة</option>
          </select>
        </Field>

        {/* التصفية الثابتة لا تحتاج حقلاً هنا — المبلغ للوحدة يُكتب لكل فاتورة شراء */}
        {basis === 'CAPITAL' && (
          <Field label={`رأس مال ${who} الافتتاحي`}>
            <MoneyInput value={capital} onChange={setCapital} placeholder="0.00" />
          </Field>
        )}

        <Field label="ملاحظة">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" />
        </Field>

        <Field label="الحالة">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            نشط
          </label>
        </Field>

        <Toggle on={useSupplier} onChange={setUseSupplier} label="تحديد مورد">
          <Combobox
            options={suppliers?.data ?? []}
            value={supplierId}
            onChange={setSupplierId}
            placeholder="اختر المورد"
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
            الحساب على أصناف هذا المورد فقط، وسعر الشراء من قوائم أسعاره.
          </div>
        </Toggle>

        {/* مصروف التشغيل يُخصم من ربح الفواتير، فلا معنى له للتصفية الثابتة */}
        {basis === 'CAPITAL' && (
          <Toggle on={useCarton} onChange={setUseCarton} label="مصروف التشغيل للكرتونة">
            <MoneyInput value={carton} onChange={setCarton} placeholder="0.00" />
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              يُخصم من ربح الفاتورة بعدد الكراتين، في المكسب والخسارة.
            </div>
          </Toggle>
        )}

        <Toggle on={useUser} onChange={setUseUser} label="حساب الدخول (يرى تصفيته فقط)">
          <Combobox options={userOptions} value={userId} onChange={setUserId} placeholder="اختر الحساب" />
        </Toggle>
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.8 }}>
        {basis === 'CAPITAL' ? (
          <>
            نسبة {who} في كل فاتورة = رأس ماله في تاريخها ÷ رأس مال الأصناف × 100، بحد أقصى 100%.
            {' '}وصافي الربح = إجمالي البيع − إجمالي الشراء
            {useCarton && Number(carton) > 0 ? ` − مصروف التشغيل (${carton} للكرتونة)` : ''}.
          </>
        ) : (
          <>
            مستحق {who} = كمية أصناف المورد في فاتورة الشراء × المبلغ للوحدة. المبلغ يُكتب لكل
            فاتورة على حدة من تاب «التصفية»، فكل فاتورة بمبلغها.
          </>
        )}
        {!useSupplier && ' بدون مورد محدد لا توجد أصناف تُحسب.'}
      </div>

      {error && <div className="err-text" style={{ marginTop: 8 }}>{error}</div>}

      <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
        <button className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? '...' : 'حفظ'}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={remove}
          style={{ marginInlineStart: 'auto' }}
        >
          حذف الاسم
        </button>
      </div>
    </div>

    {/* إضافة أو نقص رأس المال على القديم — للطريقة برأس المال فقط */}
    {partner.shareBasis === 'CAPITAL' && <CapitalPanel partner={partner} />}
    </>
  );
}
