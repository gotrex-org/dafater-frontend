'use client';

import { useEffect, useState } from 'react';
import { PageTitle, StatsGrid, StatCard, Field, CollapsibleSection, SegmentedControl } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useDashboard } from '../../dashboard/hooks';
import { useConfig, useUpdateConfig } from '../../config/hooks';
import { UsersManager } from '../../users/components/UsersManager';
import { PartiesRegistry } from '../../parties/components/PartiesRegistry';
import { ProductsManager } from '../../products/components/ProductsManager';
import { ExpenseCategoriesManager } from '../../expense-categories/components/ExpenseCategoriesManager';
import { ChargeTypesManager } from '../../charge-types/components/ChargeTypesManager';

export function SettingsView() {
  const { user, can } = useAuth();
  const { data: dash } = useDashboard();
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [graceDays, setGraceDays] = useState<number>(8);
  const [feePerDay, setFeePerDay] = useState<number>(1200);
  const [tripsMsg, setTripsMsg] = useState('');
  const [tab, setTab] = useState<'general' | 'products'>('general');
  const [salaryPct, setSalaryPct] = useState<number>(50);
  const [activityMsg, setActivityMsg] = useState('');

  useEffect(() => {
    if (config) {
      setEmail(config.orderEmail);
      setGraceDays(config.delayGraceDays);
      setFeePerDay(config.delayFeePerDay);
      setSalaryPct(config.salaryShippingPct ?? 50);
    }
  }, [config]);

  const saveEmail = () => {
    setMsg('');
    updateConfig.mutate(
      { orderEmail: email },
      { onSuccess: () => setMsg('تم الحفظ ✓'), onError: (e: any) => setMsg(e.message) },
    );
  };

  const saveTripsConfig = () => {
    setTripsMsg('');
    updateConfig.mutate(
      { delayGraceDays: graceDays, delayFeePerDay: feePerDay },
      { onSuccess: () => setTripsMsg('تم الحفظ ✓'), onError: (e: any) => setTripsMsg(e.message) },
    );
  };

  const saveActivityConfig = () => {
    setActivityMsg('');
    if (!(salaryPct >= 0 && salaryPct <= 100)) return setActivityMsg('النسبة من 0 إلى 100');
    updateConfig.mutate(
      { salaryShippingPct: salaryPct },
      { onSuccess: () => setActivityMsg('تم الحفظ ✓'), onError: (e: any) => setActivityMsg(e.message) },
    );
  };

  const counts = dash?.counts;

  // سجل الأصناف تاب لوحده — تسجيل الأصناف الجديدة من هنا بس (الفواتير بتختار من المسجّل)
  const tabs = (
    <div className="toolbar">
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'general', label: 'الإعدادات' },
          { value: 'products', label: 'سجل الأصناف' },
        ]}
      />
    </div>
  );

  if (tab === 'products') {
    return (
      <>
        <PageTitle title="سجل الأصناف" subtitle="تسجيل الأصناف وتعديلها ودمجها — الفواتير تختار من الأصناف المسجّلة هنا فقط" />
        {tabs}
        <ProductsManager />
      </>
    );
  }

  return (
    <>
      <PageTitle title="الإعدادات" subtitle="المستخدمون، الأطراف، الأصناف، المخازن، الخزينة، البنود" />
      {tabs}

      <StatsGrid>
        <StatCard label="العملاء" value={counts?.clients ?? '—'} />
        <StatCard variant="blue" label="الموردين" value={counts?.suppliers ?? '—'} />
        <StatCard variant="gold" label="الأصناف" value={counts?.products ?? '—'} />
        <StatCard label="الفواتير" value={counts?.invoices ?? '—'} />
      </StatsGrid>

      <CollapsibleSection title="إعدادات الطلبيات">
        <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <Field label="البريد الإلكتروني الذي تصل إليه طلبيات العملاء">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@gmail.com" />
          </Field>
          <div className="toolbar">
            <button className="btn btn-primary btn-sm" onClick={saveEmail} disabled={updateConfig.isPending}>حفظ الإيميل</button>
            {msg && <span className="muted">{msg}</span>}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="إعدادات رحلات السائقين" defaultOpen={false}>
        <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <Field label="فترة السماح (أيام قبل احتساب العطلة)">
            <input
              type="number"
              min={0}
              value={graceDays}
              onChange={(e) => setGraceDays(Number(e.target.value))}
            />
          </Field>
          <Field label="قيمة يوم العطلة (جنيه)">
            <input
              type="number"
              min={0}
              value={feePerDay}
              onChange={(e) => setFeePerDay(Number(e.target.value))}
            />
          </Field>
          <div className="toolbar">
            <button className="btn btn-primary btn-sm" onClick={saveTripsConfig} disabled={updateConfig.isPending}>حفظ</button>
            {tripsMsg && <span className="muted">{tripsMsg}</span>}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="بنود الشحن في الفواتير" defaultOpen={false}>
        <ChargeTypesManager />
      </CollapsibleSection>

      <CollapsibleSection title="تقسيم المصاريف بين التجارة والشحن" defaultOpen={false}>
        <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <div className="muted" style={{ fontSize: 13 }}>
            المرتبات (وأي بند نشاطه «مشترك») تُقسَّم تلقائياً بين النشاطين بهذه النسبة. النسبة تُثبَّت على الحركة وقت تسجيلها، فتغييرها لا يغيّر الحركات السابقة.
          </div>
          <Field label="نصيب الشحن من المرتبات %">
            <input type="number" min={0} max={100} value={salaryPct} onChange={(e) => setSalaryPct(Number(e.target.value))} />
          </Field>
          <div className="muted" style={{ fontSize: 12.5 }}>نصيب التجارة: {Math.max(0, 100 - (salaryPct || 0))}%</div>
          <div className="toolbar">
            <button className="btn btn-primary btn-sm" onClick={saveActivityConfig} disabled={updateConfig.isPending}>حفظ</button>
            {activityMsg && <span className="muted">{activityMsg}</span>}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="سجل العملاء والموردين وأصحاب العهد" defaultOpen={false}>
        <PartiesRegistry />
      </CollapsibleSection>

      <CollapsibleSection title="بنود المصاريف (إضافة وتعديل وحذف)" defaultOpen={false}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>تظهر هذه البنود في تقرير المصاريف. لكل بند نشاط (شحن / تجارة / مشترك) — اضغط على النشاط لتغييره، وعلامة 🚛 تعني أن البند يُربط بعربية. يمكن إضافة بند من هنا أو من الحركة اليومية، أما التعديل والحذف فمن هنا فقط.</div>
        <ExpenseCategoriesManager canManage />
      </CollapsibleSection>

      {(user?.admin || can('settings.users')) && <UsersManager />}
    </>
  );
}
