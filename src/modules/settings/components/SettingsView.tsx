'use client';

import { useEffect, useState } from 'react';
import { PageTitle, StatsGrid, StatCard, Field, CollapsibleSection } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useDashboard } from '../../dashboard/hooks';
import { useConfig, useUpdateConfig } from '../../config/hooks';
import { UsersManager } from '../../users/components/UsersManager';
import { PartiesRegistry } from '../../parties/components/PartiesRegistry';
import { ProductsManager } from '../../products/components/ProductsManager';

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
  const [productsOpen, setProductsOpen] = useState(false);

  useEffect(() => {
    if (config) {
      setEmail(config.orderEmail);
      setGraceDays(config.delayGraceDays);
      setFeePerDay(config.delayFeePerDay);
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

  const counts = dash?.counts;

  return (
    <>
      <PageTitle title="الإعدادات" subtitle="المستخدمون، الأطراف، الأصناف، المخازن، الخزينة، البنود" />

      <StatsGrid>
        <StatCard label="العملاء" value={counts?.clients ?? '—'} />
        <StatCard variant="blue" label="الموردين" value={counts?.suppliers ?? '—'} />
        <StatCard variant="gold" label="الأصناف" value={counts?.products ?? '—'} />
        <StatCard label="الفواتير" value={counts?.invoices ?? '—'} />
      </StatsGrid>

      <CollapsibleSection title="إعدادات الطلبيات">
        <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <Field label="الإيميل اللي توصله طلبيات العملاء">
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

      <CollapsibleSection title="سجل العملاء والموردين" defaultOpen={false}>
        <PartiesRegistry />
      </CollapsibleSection>

      <button
        className="card"
        style={{ width: '100%', textAlign: 'start', padding: '14px 16px', marginTop: 12, cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={() => setProductsOpen(true)}
      >
        <span style={{ fontWeight: 700, fontSize: 15 }}>سجل الأصناف</span>
        <span className="muted" style={{ fontSize: 13 }}>فتح في نافذة ←</span>
      </button>

      {(user?.admin || can('settings.users')) && <UsersManager />}

      {productsOpen && (
        <div className="modal-overlay" onClick={() => setProductsOpen(false)}>
          <div className="modal" style={{ width: '94%', maxWidth: 960, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><b>سجل الأصناف</b><button className="btn btn-ghost btn-sm" onClick={() => setProductsOpen(false)}>×</button></div>
            <div style={{ padding: 16 }}><ProductsManager /></div>
          </div>
        </div>
      )}
    </>
  );
}
