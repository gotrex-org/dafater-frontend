'use client';

import { useState } from 'react';
import { EGP } from '@/lib/format';
import { Combobox } from '@/components/common';
import { useAllTreasury } from '../../treasury/hooks';
import { useWarehouseDues, usePayWarehouseDue } from '../hooks';

// بنود المخزن المستحقة — تظهر لحد ما يتأكّد عليها إنها اتدفعت (وقتها تتخصم من الخزنة).
export function WarehouseDuesPanel({ compact = false }: { compact?: boolean }) {
  const { data: dues = [] } = useWarehouseDues();
  const { data: treasury } = useAllTreasury();
  const pay = usePayWarehouseDue();
  const [payFor, setPayFor] = useState<string | null>(null);
  const [treasuryId, setTreasuryId] = useState('');
  const [err, setErr] = useState('');

  if (!dues.length) return compact ? null : (
    <div className="section">
      <h2>بنود المخزن المستحقة</h2>
      <div className="card" style={{ padding: 14 }}><div className="muted" style={{ fontSize: 13 }}>لا توجد بنود مستحقة 👍</div></div>
    </div>
  );

  const confirmPay = (id: string) => {
    setErr('');
    if (!treasuryId) return setErr('اختر الخزنة اللي هيتخصم منها');
    pay.mutate({ id, treasuryId }, {
      onSuccess: () => { setPayFor(null); setTreasuryId(''); },
      onError: (e: any) => setErr(e.message),
    });
  };

  const body = (
    <div className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--debit)' }}>🏬 بنود مخزن مستحقة الدفع ({dues.length})</div>
      {dues.map((d) => (
        <div key={d.id} style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 8 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>{d.title}</span>
            <span className="num deb" style={{ fontWeight: 700 }}>{EGP(d.amount)}</span>
            {d.schedule?.warehouse?.name && <span className="muted" style={{ fontSize: 12 }}>{d.schedule.warehouse.name}</span>}
            <span className="muted" style={{ fontSize: 12 }}>{d.period}</span>
            <button className="btn btn-primary btn-sm" style={{ marginInlineStart: 'auto' }} onClick={() => { setPayFor(payFor === d.id ? null : d.id); setTreasuryId(''); setErr(''); }}>
              {payFor === d.id ? 'إلغاء' : 'تم الدفع'}
            </button>
          </div>
          {payFor === d.id && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>اتدفع من خزنة:</span>
              <div style={{ minWidth: 180 }}>
                <Combobox options={treasury?.data ?? []} value={treasuryId} onChange={setTreasuryId} />
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => confirmPay(d.id)} disabled={pay.isPending}>تأكيد الدفع</button>
              {err && <span className="err-text">{err}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return compact ? body : <div className="section"><h2>بنود المخزن المستحقة</h2>{body}</div>;
}
