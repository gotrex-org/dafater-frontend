'use client';

import { useState } from 'react';
import { fmtDate } from '@/lib/format';
import { fieldNavKeyDown } from '@/lib/field-nav';
import { useAuth } from '@/lib/auth';
import { PageTitle, MoneyInput } from '@/components/common';
import { useReceiveOrder, useMarkOrderDone } from '../hooks';
import type { Order } from '../dtos';

export function OrderDetail({ order, onClose }: { order: Order; onClose: () => void }) {
  const { can } = useAuth();
  const receive = useReceiveOrder();
  const markDone = useMarkOrderDone();
  const readOnly = order.status === 'DONE';

  const [recv, setRecv] = useState<Record<string, string>>(
    Object.fromEntries(order.items.map((it) => [it.id!, it.received ? String(it.received) : ''])),
  );
  const [error, setError] = useState('');

  const save = () => {
    setError('');
    receive.mutate(
      { id: order.id, items: order.items.map((it) => ({ id: it.id!, received: Number(recv[it.id!]) || 0 })) },
      { onSuccess: onClose, onError: (e: any) => setError(e.message) },
    );
  };

  const handleMarkDone = () => {
    markDone.mutate(order.id, { onSuccess: onClose, onError: (e: any) => setError(e.message) });
  };

  const customerName = order.party?.name ?? order.name;

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={onClose}>→ رجوع لقائمة الطلبيات</button>
      <PageTitle
        title={`طلبية ${customerName}`}
        subtitle={`بتاريخ ${fmtDate(order.date)}${readOnly ? ' — منتهية (للعرض فقط)' : ' — اكتب إجمالي الوارد'}`}
      />
      {order.note && <p className="muted" style={{ marginBottom: 12 }}>{order.note}</p>}
      <div className="card" onKeyDown={fieldNavKeyDown}>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>المطلوب</th><th>الصنف</th><th>الوارد</th><th>المتبقّي</th></tr>
            </thead>
            <tbody>
              {order.items.map((it) => {
                const got = Number(recv[it.id!]) || 0;
                const remaining = Math.max(0, it.qty - got);
                return (
                  <tr key={it.id}>
                    <td className="num">{it.qty}</td>
                    <td>{it.name}</td>
                    <td>
                      {readOnly
                        ? <span className="num">{it.received ?? 0}</span>
                        : <MoneyInput value={recv[it.id!] ?? ''} placeholder="0"
                            onChange={(v) => setRecv((r) => ({ ...r, [it.id!]: v }))}
                            style={{ width: 100 }} />}
                    </td>
                    <td className={`num ${remaining === 0 ? 'cre' : 'deb'}`}>{remaining}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {readOnly ? (
          <div className="muted" style={{ padding: 16 }}>طلبية منتهية — للعرض فقط.</div>
        ) : (
          <>
            <div className="err-text" style={{ padding: '0 16px' }}>{error}</div>
            <div className="toolbar" style={{ padding: 16 }}>
              {can('orders') && (
                <button className="btn btn-primary" onClick={save} disabled={receive.isPending}>
                  {receive.isPending ? '...' : 'حفظ الوارد'}
                </button>
              )}
              {can('orders') && (
                <button className="btn btn-ghost" onClick={handleMarkDone} disabled={markDone.isPending}>
                  ✓ تم بالكامل
                </button>
              )}
              <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
