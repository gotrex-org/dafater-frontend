'use client';

import { useState } from 'react';
import { EGP, QTY, fmtDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { EmptyState, MoneyInput, SearchInput, Spinner } from '@/components/common';
import { normalizeAr } from '@/lib/arabicSearch';
import {
  useFixedCandidates, useFixedInvoices, useSelectVehicles, useSetFixedRate, useUnselectVehicle,
} from '../hooks';
import type { FixedInvoice, Partner } from '../dtos';

const supplierName = (p: Partner) => p.suppliers[0]?.name ?? 'المورد';

/**
 * التصفية الثابتة: فواتير شراء المورد المختارة، ولكل واحدة مبلغ للوحدة.
 *   المستحق = مجموع كميات أصناف المورد في الفاتورة × المبلغ للوحدة
 * مثال: فاتورة شراء بها 800 وحدة ومبلغها 2 ج.م → 1,600 تدخل كشف الحساب.
 * المبلغ يُكتب لكل فاتورة على حدة، فتغييره لا يمس الفواتير الأخرى.
 */
export function FixedPanel({ partner }: { partner: Partner }) {
  const { user } = useAuth();
  const isAdmin = !!user?.admin;
  const { data, isLoading } = useFixedInvoices(partner.id);

  if (isLoading || !data) return <Spinner />;

  if (!data.length) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <b>لا توجد فواتير شراء في تصفية {partner.name} حتى الآن.</b>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {isAdmin
            ? 'اختر فواتير الشراء من «اختيار الفواتير»، ثم اكتب المبلغ للوحدة لكل فاتورة.'
            : 'يختار المالك فواتير الشراء، ثم تظهر هنا بمستحق كل واحدة.'}
        </div>
      </div>
    );
  }

  const total = data.reduce((s, v) => s + (v.amount ?? 0), 0);
  const qty = data.reduce((s, v) => s + v.qty, 0);
  const missing = data.filter((v) => v.rate == null).length;

  return (
    <>
      {missing > 0 && (
        <div className="card" style={{ padding: 10, marginBottom: 10, borderColor: 'var(--debit)' }}>
          <span style={{ fontSize: 12, color: 'var(--debit)', fontWeight: 700 }}>
            تنبيه: {missing} فاتورة بدون مبلغ للوحدة. مستحقها غير محسوب وغير داخل في الإجمالي.
          </span>
        </div>
      )}

      <div className="card tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>فاتورة شراء</th>
              <th>التاريخ</th>
              <th>المورد</th>
              <th className="num">الكمية</th>
              <th className="num">المبلغ للوحدة</th>
              <th className="num">المستحق</th>
              <th>ملاحظة</th>
            </tr>
          </thead>
          <tbody>
            {data.map((v) => (
              <tr key={v.id}>
                <td>
                  <b>#{v.invoiceNo}</b>
                  <div className="muted" style={{ fontSize: 11 }}>{v.itemCount} صنف</div>
                </td>
                <td>{fmtDate(v.date)}</td>
                <td>{v.supplierName || '—'}</td>
                <td className="num">{QTY(v.qty)}</td>
                <td className="num">
                  {isAdmin
                    ? <RateCell partner={partner} invoice={v} />
                    : (v.rate == null ? '—' : EGP(v.rate))}
                </td>
                <td className="num" style={{ color: v.amount == null ? 'var(--debit)' : undefined }}>
                  <b>{v.amount == null ? 'بدون مبلغ' : EGP(v.amount)}</b>
                </td>
                <td className="muted" style={{ fontSize: 12 }}>{v.note || '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={3}>الإجمالي</th>
              <th className="num">{QTY(qty)}</th>
              <th></th>
              <th className="num">{EGP(total)}</th>
              <th></th>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        المستحق = كمية أصناف {supplierName(partner)} في الفاتورة × المبلغ للوحدة. المبلغ يُكتب
        لكل فاتورة على حدة، والإجمالي يظهر في كشف الحساب.
      </div>
    </>
  );
}

/** خانة المبلغ للوحدة: تُكتب في الجدول نفسه وتُحفظ بالخروج منها أو بمفتاح الإدخال. */
function RateCell({ partner, invoice }: { partner: Partner; invoice: FixedInvoice }) {
  const set = useSetFixedRate(partner.id);
  const [value, setValue] = useState(invoice.rate == null ? '' : String(invoice.rate));
  const [error, setError] = useState('');

  const commit = () => {
    const raw = value.trim();
    // الخروج من خانة فارغة ليس خطأ — الخطأ يظهر عند كتابة رقم غير صالح
    if (!raw) { setError(''); return; }
    const rate = Number(raw);
    if (!(rate > 0)) {
      setError('اكتب مبلغاً أكبر من صفر');
      return;
    }
    if (rate === invoice.rate) return;
    setError('');
    set.mutate({ invoiceId: invoice.id, rate }, { onError: (e: any) => setError(e.message) });
  };

  return (
    <div style={{ minWidth: 110 }}>
      <MoneyInput
        value={value}
        onChange={(v) => { setValue(v); setError(''); }}
        onBlur={commit}
        placeholder="0.00"
      />
      {error && <div className="err-text" style={{ fontSize: 11, marginTop: 2 }}>{error}</div>}
    </div>
  );
}

/**
 * اختيار فواتير الشراء التي تدخل في التصفية الثابتة — للمالك فقط.
 * المعروض هو فواتير الشراء التي تحتوي صنفاً من أصناف المورد المحدد.
 */
export function FixedPicker({ partner }: { partner: Partner }) {
  const { data, isLoading } = useFixedCandidates(partner.id);
  const select = useSelectVehicles(partner.id);
  const unselect = useUnselectVehicle(partner.id);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  const rows = (data ?? []).filter((v) => {
    if (!search) return true;
    const q = normalizeAr(search);
    return normalizeAr(v.supplierName).includes(q) || normalizeAr(v.invoiceNo).includes(q);
  });

  const toPick = rows.filter((v) => !v.selected && checked[v.id]).map((v) => v.id);
  const busy = select.isPending || unselect.isPending;

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
        <SearchInput value={search} onChange={setSearch} placeholder="رقم فاتورة أو مورد" />
      </div>

      {isLoading ? <Spinner /> : !rows.length ? (
        <EmptyState text={`لا توجد فواتير شراء تحتوي أصناف ${supplierName(partner)}`} />
      ) : (
        <div className="card tbl-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>فاتورة شراء</th>
                <th>التاريخ</th>
                <th>المورد</th>
                <th className="num">الكمية</th>
                <th className="num">المبلغ للوحدة</th>
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
                  <td>#{v.invoiceNo}</td>
                  <td>{fmtDate(v.date)}</td>
                  <td>{v.supplierName || '—'}</td>
                  <td className="num">{QTY(v.qty)}</td>
                  <td className="num">{v.rate == null ? '—' : EGP(v.rate)}</td>
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
          ? <>الكمية هي مجموع كميات أصناف {supplierName(partner)} في الفاتورة. بعد الإضافة يُكتب المبلغ للوحدة من تاب «التصفية».</>
          : <>لا يوجد مورد محدد لـ {partner.name}، لذلك لا توجد أصناف تُحسب. حدد المورد من إعدادات التصفية.</>}
      </div>
    </>
  );
}
