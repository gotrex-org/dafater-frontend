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

const productNames = (v: FixedInvoice) => v.items.map((it) => it.productName).join('، ');

/**
 * التصفية الثابتة: فواتير شراء المورد المختارة، ولكل واحدة مبلغ للوحدة أو نسبة.
 *   بالمبلغ: المستحق = مجموع كميات أصناف المورد في الفاتورة × المبلغ للوحدة
 *   بالنسبة: المستحق = قيمة أصناف المورد في الفاتورة × النسبة
 * صاحب الاسم يضيف الفواتير بنفسه من «إضافة فواتير»، وتظهر هنا «بانتظار الموافقة»
 * حتى يكتب المالك المبلغ أو النسبة — وقبلها لا تدخل الحساب.
 */
export function FixedPanel({ partner }: { partner: Partner }) {
  const { user } = useAuth();
  const isAdmin = !!user?.admin;
  const { data, isLoading } = useFixedInvoices(partner.id);
  const unselect = useUnselectVehicle(partner.id);

  if (isLoading || !data) return <Spinner />;

  if (!data.length) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <b>لا توجد فواتير شراء في تصفية {partner.name} حتى الآن.</b>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {isAdmin
            ? 'اختر فواتير الشراء من «اختيار الفواتير»، ثم اكتب المبلغ للوحدة أو النسبة لكل فاتورة.'
            : 'أضف فواتير الشراء من «إضافة فواتير»، وبعد موافقة المالك تظهر بمستحق كل واحدة.'}
        </div>
      </div>
    );
  }

  const counted = data.filter((v) => v.amount != null);
  const total = counted.reduce((s, v) => s + (v.amount ?? 0), 0);
  const qty = counted.reduce((s, v) => s + v.qty, 0);
  const pending = data.filter((v) => !v.approved).length;

  return (
    <>
      {pending > 0 && (
        <div className="card" style={{ padding: 10, marginBottom: 10, borderColor: 'var(--accent)' }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>
            {isAdmin
              ? `${pending} فاتورة أضافها ${partner.name} بانتظار الموافقة. اكتب المبلغ للوحدة أو النسبة للموافقة عليها.`
              : `${pending} فاتورة بانتظار موافقة المالك. لا تدخل الحساب قبل الموافقة.`}
          </span>
        </div>
      )}

      <div className="card tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>فاتورة شراء</th>
              <th>التاريخ</th>
              <th>الأصناف</th>
              <th className="num">الكمية</th>
              <th className="num">القيمة</th>
              <th className="num">المبلغ للوحدة / النسبة</th>
              <th className="num">المستحق</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((v) => (
              <tr key={v.id} style={!v.approved ? { background: 'var(--accent-soft)' } : undefined}>
                <td>
                  <b>#{v.invoiceNo}</b>
                  <div className="muted" style={{ fontSize: 11 }}>{v.supplierName || '—'}</div>
                </td>
                <td>{fmtDate(v.date)}</td>
                <td className="muted" style={{ fontSize: 12 }}>{productNames(v) || '—'}</td>
                <td className="num">{QTY(v.qty)}</td>
                <td className="num">{v.value == null ? '—' : EGP(v.value)}</td>
                <td className="num">
                  {isAdmin
                    ? <RateCell partner={partner} invoice={v} />
                    : v.rate != null ? EGP(v.rate) : v.percent != null ? `${v.percent}%` : '—'}
                </td>
                <td className="num" style={{ color: v.approved && v.amount == null ? 'var(--debit)' : undefined }}>
                  {!v.approved
                    ? <span className="pill">بانتظار الموافقة</span>
                    : <b>{v.amount == null ? 'بدون مبلغ' : EGP(v.amount)}</b>}
                </td>
                <td>
                  {!isAdmin && !v.approved && (
                    <button className="btn btn-ghost btn-sm" disabled={unselect.isPending} onClick={() => unselect.mutate(v.id)}>
                      سحب
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={3}>الإجمالي</th>
              <th className="num">{QTY(qty)}</th>
              <th></th>
              <th></th>
              <th className="num">{EGP(total)}</th>
              <th></th>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        المستحق = كمية أصناف {supplierName(partner)} × المبلغ للوحدة، أو قيمة أصنافه × النسبة.
        يُكتب لكل فاتورة على حدة، والإجمالي يظهر في كشف الحساب.
      </div>
    </>
  );
}

/**
 * خانة المبلغ للوحدة أو النسبة: تُكتب في الجدول نفسه وتُحفظ بالخروج منها.
 * حفظها على فاتورة بانتظار الموافقة هو الموافقة عليها.
 */
function RateCell({ partner, invoice }: { partner: Partner; invoice: FixedInvoice }) {
  const set = useSetFixedRate(partner.id);
  const [mode, setMode] = useState<'rate' | 'percent'>(invoice.percent != null ? 'percent' : 'rate');
  const current = mode === 'percent' ? invoice.percent : invoice.rate;
  const [value, setValue] = useState(current == null ? '' : String(current));
  const [error, setError] = useState('');

  const save = () => {
    const s = value.trim();
    // الخروج من خانة فارغة ليس خطأ — الخطأ يظهر عند كتابة رقم غير صالح
    if (!s) { setError(''); return; }
    const n = Number(s);
    if (!(n > 0)) return setError(mode === 'percent' ? 'اكتب نسبة أكبر من صفر' : 'اكتب مبلغاً أكبر من صفر');
    if (mode === 'percent' && n > 100) return setError('النسبة حتى 100%');
    const same = mode === 'percent' ? invoice.percent === n : invoice.rate === n;
    if (same && invoice.approved) return;
    setError('');
    set.mutate(
      mode === 'percent' ? { invoiceId: invoice.id, percent: n } : { invoiceId: invoice.id, rate: n },
      { onError: (e: any) => setError(e.message) },
    );
  };

  const switchMode = (m: 'rate' | 'percent') => {
    setMode(m);
    const v = m === 'percent' ? invoice.percent : invoice.rate;
    setValue(v == null ? '' : String(v));
    setError('');
  };

  return (
    <div style={{ minWidth: 150 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <select
          value={mode}
          onChange={(e) => switchMode(e.target.value as 'rate' | 'percent')}
          style={{ padding: '6px 4px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 12 }}
        >
          <option value="rate">ج.م للوحدة</option>
          <option value="percent">نسبة %</option>
        </select>
        <MoneyInput
          value={value}
          onChange={(v) => { setValue(v); setError(''); }}
          onBlur={save}
          placeholder={mode === 'percent' ? '0%' : '0.00'}
        />
      </div>
      {mode === 'percent' && invoice.value == null && (
        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>فاتورة دولار غير مسعّرة. لن تُحسب النسبة حتى تُسعَّر.</div>
      )}
      {error && <div className="err-text" style={{ fontSize: 11, marginTop: 2 }}>{error}</div>}
    </div>
  );
}

/**
 * اختيار فواتير الشراء التي تدخل في التصفية الثابتة. المعروض هو فواتير شراء
 * المورد التي تحتوي صنفاً من أصنافه، والبحث باسم الصنف أو رقم الفاتورة.
 * المالك يضيفها موافقاً عليها، وصاحب الاسم يضيفها فتنتظر موافقة المالك.
 */
export function FixedPicker({ partner }: { partner: Partner }) {
  const { user } = useAuth();
  const isAdmin = !!user?.admin;
  const { data, isLoading } = useFixedCandidates(partner.id);
  const select = useSelectVehicles(partner.id);
  const unselect = useUnselectVehicle(partner.id);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  const q = normalizeAr(search.trim());
  const rows = (data ?? []).filter((v) => !q
    || normalizeAr(v.invoiceNo).includes(q)
    || normalizeAr(v.supplierName).includes(q)
    || v.items.some((it) => normalizeAr(it.productName).includes(q)));

  const toPick = rows.filter((v) => !v.selected && checked[v.id]).map((v) => v.id);
  const busy = select.isPending || unselect.isPending;

  return (
    <>
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="اسم الصنف أو رقم الفاتورة" />
        <button
          className="btn btn-primary btn-sm"
          disabled={busy || !toPick.length}
          onClick={() => select.mutate(toPick, { onSuccess: () => setChecked({}) })}
        >
          {isAdmin ? 'إضافة المحدد' : 'إرسال للموافقة'}{toPick.length ? ` (${toPick.length})` : ''}
        </button>
      </div>
      {select.error && <div className="err-text" style={{ marginBottom: 8 }}>{(select.error as any).message}</div>}

      {isLoading ? <Spinner /> : !rows.length ? (
        <EmptyState text={q ? 'لا توجد فواتير شراء بهذا الصنف' : `لا توجد فواتير شراء تحتوي أصناف ${supplierName(partner)}`} />
      ) : (
        <div className="card tbl-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>فاتورة شراء</th>
                <th>التاريخ</th>
                <th>الأصناف</th>
                <th className="num">الكمية</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                // الصنف المطابق للبحث بكميته، وبدون بحث كل الأصناف
                const hits = q ? v.items.filter((it) => normalizeAr(it.productName).includes(q)) : [];
                const canRemove = v.selected && (isAdmin || !v.approved);
                return (
                  <tr key={v.id} style={v.selected ? { background: 'var(--accent-soft)' } : undefined}>
                    <td>
                      {v.selected ? (
                        <span className="pill">{v.approved ? 'محددة' : 'بانتظار الموافقة'}</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={!!checked[v.id]}
                          onChange={(e) => setChecked((p) => ({ ...p, [v.id]: e.target.checked }))}
                        />
                      )}
                    </td>
                    <td>
                      #{v.invoiceNo}
                      <div className="muted" style={{ fontSize: 11 }}>{v.supplierName || '—'}</div>
                    </td>
                    <td>{fmtDate(v.date)}</td>
                    <td style={{ fontSize: 12 }}>
                      {hits.length
                        ? hits.map((it) => <div key={it.id}><b>{it.productName}</b> <span className="muted">{QTY(it.qty)}</span></div>)
                        : <span className="muted">{productNames(v)}</span>}
                    </td>
                    <td className="num">{QTY(v.qty)}</td>
                    <td>
                      {canRemove && (
                        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => unselect.mutate(v.id)}>
                          {isAdmin ? 'إزالة' : 'سحب'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        {!partner.suppliers.length
          ? <>لا يوجد مورد محدد لـ {partner.name}، لذلك لا توجد أصناف تُحسب. حدد المورد من إعدادات التصفية.</>
          : isAdmin
            ? <>الكمية هي مجموع كميات أصناف {supplierName(partner)} في الفاتورة. بعد الإضافة يُكتب المبلغ للوحدة أو النسبة من «فواتير الشراء».</>
            : <>الفواتير المرسلة تنتظر موافقة المالك، ويمكن سحبها قبل الموافقة.</>}
      </div>
    </>
  );
}
