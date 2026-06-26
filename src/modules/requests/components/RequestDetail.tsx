'use client';

import { useState } from 'react';
import { fmtDate } from '@/lib/format';
import { fieldNavKeyDown } from '@/lib/field-nav';
import { useAuth } from '@/lib/auth';
import { PageTitle, MoneyInput } from '@/components/common';
import { useReceiveRequest } from '../hooks';
import type { ClientRequest } from '../dtos';

export function RequestDetail({ request, onClose }: { request: ClientRequest; onClose: () => void }) {
  const { can } = useAuth();
  const receive = useReceiveRequest();
  const readOnly = request.done; // completed orders are a read-only reference
  // الوارد = إجمالي المستلم (مطلق) — تزوّده كل ما يجي وارد جديد
  const [recv, setRecv] = useState<Record<string, string>>(
    Object.fromEntries(request.items.map((it) => [it.id!, it.received ? String(it.received) : ''])),
  );
  const [error, setError] = useState('');

  const save = () => {
    setError('');
    receive.mutate(
      { id: request.id, items: request.items.map((it) => ({ id: it.id!, received: Number(recv[it.id!]) || 0 })) },
      { onSuccess: onClose, onError: (e: any) => setError(e.message) },
    );
  };

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={onClose}>→ رجوع لقائمة الطلبيات</button>
      <PageTitle title={`طلبية ${request.client?.name ?? ''}`} subtitle={`بتاريخ ${fmtDate(request.date)}${readOnly ? ' — منتهية (مرجع للعرض فقط)' : ' — اكتب إجمالي الوارد'}`} />
      <div className="card" onKeyDown={fieldNavKeyDown}>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>المطلوب</th><th>الصنف</th><th>الوارد</th><th>المتبقّي</th></tr></thead>
            <tbody>
              {request.items.map((it) => {
                const got = Number(recv[it.id!]) || 0;
                const remaining = Math.max(0, it.qty - got);
                return (
                  <tr key={it.id}>
                    <td className="num">{it.qty}</td>
                    <td>{it.name}</td>
                    <td>
                      {readOnly
                        ? <span className="num">{it.received ?? 0}</span>
                        : <MoneyInput value={recv[it.id!] ?? ''} placeholder="0" onChange={(v) => setRecv((r) => ({ ...r, [it.id!]: v }))} style={{ width: 100 }} />}
                    </td>
                    <td className={`num ${remaining === 0 ? 'cre' : 'deb'}`}>{remaining}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {readOnly ? (
          <div className="muted" style={{ padding: 16 }}>طلبية منتهية — للعرض فقط، غير قابلة للتعديل.</div>
        ) : (
          <>
            <div className="err-text" style={{ padding: '0 16px' }}>{error}</div>
            <div className="toolbar" style={{ padding: 16 }}>
              {can('requests.receive') && <button className="btn btn-primary" onClick={save} disabled={receive.isPending}>{receive.isPending ? '...' : 'حفظ الوارد'}</button>}
              <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
