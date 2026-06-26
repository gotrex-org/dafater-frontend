'use client';

import { useEffect, useState } from 'react';
import { PageTitle, StatsGrid, StatCard, Field, CollapsibleSection } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useDashboard } from '../../dashboard/hooks';
import { useConfig, useUpdateConfig } from '../../config/hooks';
import { UsersManager } from '../../users/components/UsersManager';
import { PartiesRegistry } from '../../parties/components/PartiesRegistry';

export function SettingsView() {
  const { user, can } = useAuth();
  const { data: dash } = useDashboard();
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { if (config) setEmail(config.orderEmail); }, [config]);

  const saveEmail = () => {
    setMsg('');
    updateConfig.mutate(
      { orderEmail: email },
      { onSuccess: () => setMsg('تم الحفظ ✓'), onError: (e: any) => setMsg(e.message) },
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

      <CollapsibleSection title="سجل العملاء والموردين" defaultOpen={false}>
        <PartiesRegistry />
      </CollapsibleSection>

      {(user?.admin || can('settings.users')) && <UsersManager />}
    </>
  );
}
