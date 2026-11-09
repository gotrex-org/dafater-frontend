'use client';

import { EGP, QTY, fmtDate } from '@/lib/format';
import { Spinner } from '@/components/common';
import { useDeletePosting, usePosting, useSettlementAdmin } from '../hooks';
import type { Partner } from '../dtos';

const NUM = { textAlign: 'center' as const, verticalAlign: 'top' as const };
const WRAP = { whiteSpace: 'normal' as const, overflowWrap: 'anywhere' as const, verticalAlign: 'top' as const };

const docLabel =(kind: 'invoice' | 'deal', no: string) => `${kind === 'deal' ? 'بيع خارجي' : 'فاتورة شراء'} #${no}`;

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
                {/* عرض ثابت لكل عمود والأرقام في النص: كل رقم تحت عنوانه وتحت اللي فوقه */}
                <table style={{ tableLayout: 'fixed', minWidth: isAdmin ? 640 : 420 }}>
                  <colgroup>
                    <col />
                    <col style={{ width: isAdmin ? '22%' : '30%' }} />
                    <col style={{ width: isAdmin ? '11%' : '16%' }} />
                    {isAdmin && <col style={{ width: '14%' }} />}
                    {isAdmin && <col style={{ width: '15%' }} />}
                    <col style={{ width: isAdmin ? '15%' : '22%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>الصنف</th>
                      <th>المستند</th>
                      <th className="num" style={NUM}>الكمية</th>
                      {isAdmin && <th className="num" style={NUM}>سعر الشراء</th>}
                      {isAdmin && <th className="num" style={NUM}>الفرق</th>}
                      <th className="num" style={NUM}>المستحق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((v) => (
                      <tr key={v.id}>
                        <td style={WRAP}><b>{v.productName}</b></td>
                        <td style={WRAP}>
                          {docLabel(v.kind, v.invoiceNo)}
                          <div className="muted" style={{ fontSize: 11 }}>{fmtDate(v.date)} — {v.supplierName || '—'}</div>
                        </td>
                        <td className="num" style={NUM}>{QTY(v.qty)}</td>
                        {isAdmin && <td className="num" style={NUM}>{v.unitPrice == null ? '—' : EGP(v.unitPrice)}</td>}
                        {isAdmin && (
                          <td className="num" style={NUM}>
                            {v.rate != null ? EGP(v.rate) : v.percent != null ? `${v.percent}%` : '—'}
                            {v.rate != null && <div className="muted" style={{ fontSize: 11 }}>للوحدة</div>}
                          </td>
                        )}
                        <td className="num" style={NUM}><b>{EGP(v.amount ?? 0)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={isAdmin ? 5 : 3}>الإجمالي ({data.items.length} صنف)</th>
                      <th className="num" style={NUM}>{EGP(data.total)}</th>
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
