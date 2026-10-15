'use client';

import { useState } from 'react';
import { EGP, fmtDate } from '@/lib/format';
import { EmptyState, SearchInput, Spinner } from '@/components/common';
import { normalizeAr } from '@/lib/arabicSearch';
import {
  useCandidates, useSelectAllVehicles, useSelectVehicles, useUnselectVehicle,
} from '../hooks';
import type { Partner } from '../dtos';

const supplierName = (p: Partner) => p.suppliers[0]?.name ?? 'المورد';

/**
 * اختيار الفواتير التي يدخل فيها هذا الاسم — للمالك فقط.
 * إما تحديد فواتير معينة، أو تحديد كل الفواتير.
 * الفواتير المعروضة هي فواتير البيع التي تحتوي صنفاً من أصناف المورد.
 */
export function VehiclePicker({ partner }: { partner: Partner }) {
  const { data, isLoading } = useCandidates(partner.id);
  const select = useSelectVehicles(partner.id);
  const selectAll = useSelectAllVehicles(partner.id);
  const unselect = useUnselectVehicle(partner.id);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  const rows = (data ?? []).filter((v) => {
    if (!search) return true;
    const q = normalizeAr(search);
    return (
      normalizeAr(v.clientName).includes(q) ||
      normalizeAr(v.invoiceNo).includes(q) ||
      normalizeAr(v.vehicleNo ?? '').includes(q)
    );
  });

  const toPick = rows.filter((v) => !v.selected && checked[v.id]).map((v) => v.id);
  const busy = select.isPending || selectAll.isPending || unselect.isPending;

  return (
    <>
      <div className="toolbar">
        <button
          className="btn btn-primary btn-sm"
          disabled={busy || !toPick.length}
          onClick={() => select.mutate(toPick, { onSuccess: () => setChecked({}) })}
        >
          إضافة المحدد{toPick.length ? ` (${toPick.length})` : ''}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`إضافة كل الفواتير إلى تصفية ${partner.name}؟`)) selectAll.mutate();
          }}
        >
          تحديد كل الفواتير
        </button>
        <SearchInput value={search} onChange={setSearch} placeholder="عميل أو رقم فاتورة أو رقم عربية" />
      </div>

      {isLoading ? <Spinner /> : !rows.length ? (
        <EmptyState text={`لا توجد فواتير بيع تحتوي أصناف ${supplierName(partner)}`} />
      ) : (
        <div className="card tbl-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>العربية</th>
                <th>فاتورة</th>
                <th>التاريخ</th>
                <th>العميل</th>
                <th className="num">رأس المال</th>
                <th className="num">نصيب {partner.name}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} style={v.selected ? { background: 'var(--accent-soft)' } : undefined}>
                  <td>
                    {v.selected ? (
                      <span className="pill">محددة</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={!!checked[v.id]}
                        onChange={(e) => setChecked((p) => ({ ...p, [v.id]: e.target.checked }))}
                      />
                    )}
                  </td>
                  <td>
                    {v.vehicleNo || v.vehicleLabel || '—'}
                    {v.noPricePeriod && (
                      <div style={{ fontSize: 11, color: 'var(--debit)', fontWeight: 700 }}>
                        لا توجد قائمة أسعار لتاريخ الفاتورة
                      </div>
                    )}
                  </td>
                  <td>
                    #{v.invoiceNo}
                    {v.hidden && <span className="muted" style={{ fontSize: 11 }}> (مؤرشفة)</span>}
                  </td>
                  <td>{fmtDate(v.date)}</td>
                  <td>{v.clientName || '—'}</td>
                  <td className="num">{EGP(v.capital)}</td>
                  <td className="num">{v.share === null ? '—' : EGP(v.share)}</td>
                  <td>
                    {v.selected && (
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => unselect.mutate(v.id)}
                      >
                        إزالة
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        {partner.suppliers.length
          ? <>الحساب على أصناف {supplierName(partner)} الموجودة في الفاتورة فقط. أي صنف آخر أو بند خدمي يتم تجاهله.</>
          : <>لا يوجد مورد محدد لـ {partner.name}، لذلك لا توجد أصناف تُحسب. حدد المورد من إعدادات التصفية.</>}
      </div>
    </>
  );
}
