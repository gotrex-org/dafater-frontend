'use client';

import { EGP, QTY, fmtDate } from '@/lib/format';
import { Spinner } from '@/components/common';
import { useDeletePosting, usePosting, useSettlementAdmin } from '../hooks';
import type { Partner } from '../dtos';

const docLabel = (kind: 'invoice' | 'deal', no: string) => `${kind === 'deal' ? 'بيع خارجي' : 'فاتورة شراء'} #${no}`;

/**
 * ترحيل من كشف الحساب زي الفاتورة: أصنافه بكمياتها وسعر الشراء والفرق (المبلغ للوحدة
 * أو النسبة) والمستحق، والإجمالي. صاحب الاسم يرى الكمية والمستحق فقط. حذف الترحيل
 * للمدير، وبيرجّع أصنافه غير مرحّلة.
 */
export function PostingModal({ partner, id, onClose }: { partner: Partner; id: string; onClose: () => void }) {
  const isAdmin = useSettlementAdmin();
  const { data, isLoading } = usePosting(partner.id, id);
  const del = useDeletePosting(partner.id);

  const remove = () => {
    if (!window.confirm('حذف هذا الترحيل؟ أصنافه ترجع غير مرحّلة وتخرج من كشف الحساب.')) return;
    del.mutate(id, { onSuccess: onClose });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 900, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>{data ? `ترحيل #${data.no} — ${partner.name}` : 'ترحيل'}</b>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {isLoading || !data ? <Spinner /> : (
            <>
              <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                التاريخ: {fmtDate(data.date)}{data.note ? ` — ${data.note}` : ''}
              </div>
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>الصنف</th>
                      <th>المستند</th>
                      <th className="num">الكمية</th>
                      {isAdmin && <th className="num">سعر الشراء</th>}
                      {isAdmin && <th className="num">الفرق</th>}
                      <th className="num">المستحق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((v) => (
                      <tr key={v.id}>
                        <td><b>{v.productName}</b></td>
                        <td>
                          {docLabel(v.kind, v.invoiceNo)}
                          <div className="muted" style={{ fontSize: 11 }}>{fmtDate(v.date)} — {v.supplierName || '—'}</div>
                        </td>
                        <td className="num">{QTY(v.qty)}</td>
                        {isAdmin && <td className="num">{v.unitPrice == null ? '—' : EGP(v.unitPrice)}</td>}
                        {isAdmin && (
                          <td className="num">
                            {v.rate != null ? `${EGP(v.rate)} للوحدة` : v.percent != null ? `${v.percent}%` : '—'}
                          </td>
                        )}
                        <td className="num"><b>{EGP(v.amount ?? 0)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={isAdmin ? 5 : 3}>الإجمالي ({data.items.length} صنف)</th>
                      <th className="num">{EGP(data.total)}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {isAdmin && (
                <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--debit)' }} disabled={del.isPending} onClick={remove}>
                    حذف الترحيل
                  </button>
                  {del.error && <span className="err-text">{(del.error as any).message}</span>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
