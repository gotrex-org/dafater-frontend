'use client';

import { useState } from 'react';
import { EGP, QTY, fmtDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { MoneyInput, Spinner } from '@/components/common';
import { usePriceLists, useSetItemWeek, useUpdateVehicle, useVehicle } from '../hooks';
import type { Partner } from '../dtos';

/**
 * تفاصيل العربية: كل صنف وسعر شرائه، ومن أي قائمة أسعار.
 * المالك يمكنه تحديد فترة أخرى لصنف معين (عند تقسيم دفع العربية على فترتين)،
 * وتعديل عدد الكراتين إذا كان مجموع الكميات مختلفاً عن العدد الفعلي.
 */
export function VehicleDetailModal(
  { partner, id, onClose }: { partner: Partner; id: string; onClose: () => void },
) {
  const { user } = useAuth();
  const isAdmin = !!user?.admin;
  // تحديد فترة لصنف يفيد فقط عند قراءة التكلفة من قوائم الأسعار
  const usesLists = partner.suppliers.length > 0;
  const { data: v, isLoading } = useVehicle(partner.id, id);
  const { data: lists } = usePriceLists(partner.id);
  const setWeek = useSetItemWeek(partner.id);
  const updateVehicle = useUpdateVehicle(partner.id);
  const [cartons, setCartons] = useState<string | null>(null);

  const title = v ? (v.vehicleNo || v.vehicleLabel || `فاتورة #${v.invoiceNo}`) : 'العربية';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 980, width: '96%', maxHeight: '88vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <b>{title}</b>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {isLoading || !v ? <Spinner /> : (
            <>
              <div className="mf-info">
                <span className="mf-info-l">الفاتورة</span>
                <span className="mf-info-v">#{v.invoiceNo} — {fmtDate(v.date)} — {v.clientName || '—'}</span>
              </div>
              {v.manifestNo && (
                <div className="mf-info">
                  <span className="mf-info-l">كشف العربية</span>
                  <span className="mf-info-v">#{v.manifestNo}</span>
                </div>
              )}

              {!!v.warnings.length && (
                <div className="card" style={{ padding: 10, margin: '8px 0', borderColor: 'var(--debit)' }}>
                  {v.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--debit)' }}>{w}</div>
                  ))}
                </div>
              )}

              <div className="tbl-wrap" style={{ margin: '10px 0' }}>
                <table>
                  <thead>
                    <tr>
                      <th>الصنف</th>
                      <th className="num">الكمية</th>
                      <th className="num">سعر البيع</th>
                      <th className="num">سعر الشراء</th>
                      <th>{usesLists ? 'من قائمة أسعار' : 'مصدر سعر الشراء'}</th>
                      <th className="num">رأس المال</th>
                      <th className="num">الربح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.lines.map((l) => (
                      <tr key={l.id}>
                        <td>
                          {l.productName}
                          {l.unit && <span className="muted" style={{ fontSize: 11 }}> / {l.unit}</span>}
                        </td>
                        <td className="num">{QTY(l.qty)}</td>
                        <td className="num">{l.salePrice === null ? '—' : EGP(l.salePrice)}</td>
                        <td className="num">
                          {l.purchasePrice === null
                            ? <span style={{ color: 'var(--debit)' }}>لا يوجد سعر</span>
                            : EGP(l.purchasePrice)}
                        </td>
                        <td>
                          {!usesLists ? (
                            <span className="muted" style={{ fontSize: 12 }}>—</span>
                          ) : isAdmin ? (
                            <select
                              value={l.weekForced ? (l.weekId ?? '') : ''}
                              disabled={setWeek.isPending}
                              onChange={(e) =>
                                setWeek.mutate({
                                  invoiceId: v.id,
                                  productId: l.productId,
                                  priceListId: e.target.value || null,
                                })
                              }
                              style={{ padding: '4px 6px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 12 }}
                            >
                              <option value="">
                                {l.weekStart
                                  ? `فترة تاريخ الفاتورة (${l.weekStart} → ${l.weekEnd})`
                                  : 'فترة تاريخ الفاتورة — لا توجد قائمة'}
                              </option>
                              {(lists ?? []).map((pl) => (
                                <option key={pl.id} value={pl.id}>{pl.weekStart} → {pl.weekEnd}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="muted" style={{ fontSize: 12 }}>
                              {l.weekStart ? `${l.weekStart} → ${l.weekEnd}` : '—'}
                              {l.weekForced ? ' (محددة يدوياً)' : ''}
                            </span>
                          )}
                        </td>
                        <td className="num">{l.capital === null ? '—' : EGP(l.capital)}</td>
                        <td className="num" style={{ color: (l.profit ?? 0) < 0 ? 'var(--debit)' : undefined }}>
                          {l.profit === null ? '—' : EGP(l.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mf-info">
                <span className="mf-info-l">رأس مال العربية</span>
                <span className="mf-info-v num">{EGP(v.capital)}</span>
              </div>
              <div className="mf-info">
                <span className="mf-info-l">ربح الأصناف</span>
                <span className="mf-info-v num">{v.grossProfit === null ? '—' : EGP(v.grossProfit)}</span>
              </div>
              <div className="mf-info">
                <span className="mf-info-l">
                  مصروف التشغيل ({QTY(v.cartons)} كرتونة{v.cartonsOverridden ? ' — معدّل يدوياً' : ''})
                </span>
                <span className="mf-info-v num">− {EGP(v.opExpense)}</span>
              </div>
              <div className="mf-info">
                <span className="mf-info-l">ربح العربية</span>
                <span className="mf-info-v num" style={{ color: (v.profit ?? 0) < 0 ? 'var(--debit)' : undefined }}>
                  <b>{v.profit === null ? '—' : EGP(v.profit)}</b>
                </span>
              </div>
              <div className="mf-info">
                <span className="mf-info-l">
                  نسبة {partner.name}
                </span>
                {/* رأس ماله في تاريخ الفاتورة، لا رأس ماله اليوم */}
                <span className="mf-info-v num" title={`رأس ماله في تاريخ الفاتورة ${EGP(v.ownCapital)}`}>
                  {EGP(v.percent)}%
                </span>
              </div>
              <div className="mf-info">
                <span className="mf-info-l">
                  نصيب {partner.name}
                </span>
                <span className="mf-info-v num" style={{ color: (v.share ?? 0) < 0 ? 'var(--debit)' : undefined }}>
                  <b>{v.share === null ? '—' : EGP(v.share)}</b>
                </span>
              </div>

              {isAdmin && (
                <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
                  <span className="muted" style={{ fontSize: 12 }}>عدد الكراتين</span>
                  <MoneyInput
                    value={cartons ?? (v.cartonsOverridden ? String(v.cartons) : '')}
                    onChange={setCartons}
                    placeholder={`${QTY(v.cartons)} (مجموع الكميات)`}
                    style={{ maxWidth: 140 }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={updateVehicle.isPending || cartons === null}
                    onClick={() => {
                      const raw = (cartons ?? '').trim();
                      updateVehicle.mutate(
                        { id: v.id, dto: { cartons: raw === '' ? null : Number(raw) } },
                        { onSuccess: () => setCartons(null) },
                      );
                    }}
                  >
                    حفظ
                  </button>
                  <span className="muted" style={{ fontSize: 11 }}>
                    اتركها فارغة للرجوع إلى مجموع كميات الأصناف
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
