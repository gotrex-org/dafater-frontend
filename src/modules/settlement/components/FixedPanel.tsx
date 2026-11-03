'use client';

import { useState } from 'react';
import { EGP, QTY, fmtDate } from '@/lib/format';
import { EmptyState, MoneyInput, SearchInput, SegmentedControl, Spinner } from '@/components/common';
import { useAddItems, useFixedItems, useItemSearch, useRemoveItem, useSetItemRate, useSettlementAdmin } from '../hooks';
import type { FixedItem, ItemRef, Partner } from '../dtos';

const refKey = (r: ItemRef) => `${r.kind ?? 'invoice'}:${r.invoiceId}:${r.productId}`;
const docLabel = (kind: 'invoice' | 'deal', no: string) => `${kind === 'deal' ? 'بيع خارجي' : 'فاتورة شراء'} #${no}`;

/**
 * التصفية الثابتة: أصناف مختارة من فواتير الشراء والبيع الخارجي، ولكل صنف مبلغ
 * للوحدة أو نسبة.
 *   بالمبلغ: المستحق = كمية الصنف × المبلغ للوحدة
 *   بالنسبة: المستحق = قيمة شراء الصنف × النسبة
 * «الأصناف»: اللي لسه بدون مبلغ أو نسبة (ومنها اللي صاحب الاسم أضافها بانتظار
 * الموافقة). أول ما يُكتب المبلغ أو النسبة الصنف بيروح «الأرشيف».
 * صاحب الاسم يرى الكمية والمستحق فقط — القيمة والمبلغ للوحدة والنسبة للمالك.
 */
export function FixedPanel({ partner }: { partner: Partner }) {
  const isAdmin = useSettlementAdmin();
  const { data, isLoading } = useFixedItems(partner.id);
  const [view, setView] = useState<'open' | 'archive'>('open');

  if (isLoading || !data) return <Spinner />;

  if (!data.length) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <b>لا توجد أصناف في تصفية {partner.name} حتى الآن.</b>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {isAdmin
            ? 'اختر الأصناف من «اختيار الأصناف»، ثم اكتب المبلغ للوحدة أو النسبة لكل صنف.'
            : 'اختر الأصناف من «اختيار الأصناف»، وبعد موافقة المالك تظهر بمستحق كل صنف.'}
        </div>
      </div>
    );
  }

  const open = data.filter((v) => !v.priced);
  const archive = data.filter((v) => v.priced);
  const rows = view === 'open' ? open : archive;
  const pending = data.filter((v) => !v.approved).length;

  return (
    <>
      {pending > 0 && (
        <div className="card" style={{ padding: 10, marginBottom: 10, borderColor: 'var(--accent)' }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>
            {isAdmin
              ? `${pending} صنف اختاره ${partner.name} بانتظار الموافقة. اكتب المبلغ للوحدة أو النسبة للموافقة عليه.`
              : `${pending} صنف بانتظار موافقة المالك. لا يدخل الحساب قبل الموافقة.`}
          </span>
        </div>
      )}

      <div className="toolbar">
        <SegmentedControl
          value={view}
          onChange={(v) => setView(v as 'open' | 'archive')}
          options={[
            { value: 'open', label: `الأصناف (${open.length})` },
            { value: 'archive', label: `الأرشيف (${archive.length})` },
          ]}
        />
      </div>

      {!rows.length ? (
        <EmptyState text={view === 'open' ? 'كل الأصناف لها مبلغ أو نسبة — موجودة في الأرشيف' : 'لا توجد أصناف في الأرشيف بعد'} />
      ) : (
        <ItemsTable partner={partner} rows={rows} isAdmin={isAdmin} archive={view === 'archive'} />
      )}

      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        {isAdmin
          ? 'المستحق = كمية الصنف × المبلغ للوحدة، أو قيمة الشراء × النسبة. بعد كتابة المبلغ أو النسبة ينتقل الصنف إلى الأرشيف، والإجمالي يظهر في كشف الحساب.'
          : 'المستحق يظهر بعد موافقة المالك، والإجمالي في كشف الحساب.'}
      </div>
    </>
  );
}

function ItemsTable({ partner, rows, isAdmin, archive }: {
  partner: Partner; rows: FixedItem[]; isAdmin: boolean; archive: boolean;
}) {
  const remove = useRemoveItem(partner.id);
  const total = rows.reduce((s, v) => s + (v.amount ?? 0), 0);
  // صاحب الاسم: الصنف والمستند والكمية والمستحق فقط
  const cols = isAdmin ? 9 : 6;

  return (
    <div className="card tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>الصنف</th>
            <th>المستند</th>
            <th>التاريخ</th>
            <th>سجّلها</th>
            <th className="num">الكمية</th>
            {isAdmin && <th className="num">القيمة</th>}
            {isAdmin && <th className="num">المبلغ للوحدة / النسبة</th>}
            <th className="num">المستحق</th>
            {isAdmin && <th></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} style={!v.approved ? { background: 'var(--accent-soft)' } : undefined}>
              <td><b>{v.productName}</b></td>
              <td>
                {docLabel(v.kind, v.invoiceNo)}
                <div className="muted" style={{ fontSize: 11 }}>{v.supplierName || '—'}</div>
              </td>
              <td>{fmtDate(v.date)}</td>
              <td className="muted" style={{ fontSize: 12 }}>{v.buyer || '—'}</td>
              <td className="num">{QTY(v.qty)}</td>
              {isAdmin && <td className="num">{v.value == null ? '—' : EGP(v.value)}</td>}
              {isAdmin && <td className="num"><RateCell partner={partner} item={v} /></td>}
              <td className="num" style={{ color: v.approved && v.amount == null ? 'var(--debit)' : undefined }}>
                {!v.approved
                  ? <span className="pill">بانتظار الموافقة</span>
                  : <b>{v.amount == null ? 'بدون مبلغ' : EGP(v.amount)}</b>}
              </td>
              {isAdmin && (
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={remove.isPending}
                    onClick={() => { if (window.confirm(`إزالة ${v.productName} من التصفية؟`)) remove.mutate(v); }}
                  >
                    إزالة
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {archive && (
          <tfoot>
            <tr>
              <th colSpan={cols - (isAdmin ? 2 : 1)}>الإجمالي</th>
              <th className="num">{EGP(total)}</th>
              {isAdmin && <th></th>}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/**
 * خانة المبلغ للوحدة أو النسبة: تُكتب في الجدول نفسه وتُحفظ بالخروج منها.
 * حفظها هو الموافقة على الصنف، وبعدها ينتقل إلى الأرشيف.
 */
function RateCell({ partner, item }: { partner: Partner; item: FixedItem }) {
  const set = useSetItemRate(partner.id);
  const [mode, setMode] = useState<'rate' | 'percent'>(item.percent != null ? 'percent' : 'rate');
  const current = mode === 'percent' ? item.percent : item.rate;
  const [value, setValue] = useState(current == null ? '' : String(current));
  const [error, setError] = useState('');

  const save = () => {
    const s = value.trim();
    // الخروج من خانة فارغة ليس خطأ — الخطأ يظهر عند كتابة رقم غير صالح
    if (!s) { setError(''); return; }
    const n = Number(s);
    if (!(n > 0)) return setError(mode === 'percent' ? 'اكتب نسبة أكبر من صفر' : 'اكتب مبلغاً أكبر من صفر');
    if (mode === 'percent' && n > 100) return setError('النسبة حتى 100%');
    const same = mode === 'percent' ? item.percent === n : item.rate === n;
    if (same && item.approved) return;
    setError('');
    set.mutate(
      { ref: item, body: mode === 'percent' ? { percent: n } : { rate: n } },
      { onError: (e: any) => setError(e.message) },
    );
  };

  const switchMode = (m: 'rate' | 'percent') => {
    setMode(m);
    const v = m === 'percent' ? item.percent : item.rate;
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
      {mode === 'percent' && item.value == null && (
        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>مستند بالدولار غير مسعّر. لن تُحسب النسبة حتى يُسعَّر.</div>
      )}
      {error && <div className="err-text" style={{ fontSize: 11, marginTop: 2 }}>{error}</div>}
    </div>
  );
}

/**
 * «اختيار الأصناف»: يُكتب اسم الصنف (مثلاً فريدا) فتظهر تحته كل فواتير الشراء
 * وعمليات البيع الخارجي التي فيها هذا الصنف في الفترة المحددة، ومن سجّل كل واحدة،
 * ويُحدَّد الصنف من كل مستند. المالك يضيفه موافقاً عليه، وصاحب الاسم يضيفه فينتظر
 * موافقة المالك — وصاحب الاسم يضيف فقط، والإزالة للمالك.
 */
export function FixedPicker({ partner }: { partner: Partner }) {
  const isAdmin = useSettlementAdmin();
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = search.trim();
  const { data, isLoading, isFetching } = useItemSearch(partner.id, q, from || undefined, to || undefined);
  const add = useAddItems(partner.id);
  const remove = useRemoveItem(partner.id);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const rows = data ?? [];
  const free: ItemRef[] = rows.flatMap((doc) => doc.items.filter((it) => !it.selected)
    .map((it) => ({ invoiceId: doc.invoiceId, productId: it.productId, kind: doc.kind })));
  const toPick = free.filter((r) => checked[refKey(r)]);
  const allChecked = free.length > 0 && toPick.length === free.length;
  const busy = add.isPending || remove.isPending;
  const totalQty = rows.reduce((s, doc) => s + doc.items.reduce((a, it) => a + it.qty, 0), 0);

  const toggleAll = () => setChecked(allChecked ? {} : Object.fromEntries(free.map((r) => [refKey(r), true])));

  return (
    <>
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="اسم الصنف" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
          من <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
          إلى <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button
          className="btn btn-primary btn-sm"
          disabled={busy || !toPick.length}
          onClick={() => add.mutate(toPick, { onSuccess: () => setChecked({}) })}
        >
          {isAdmin ? 'إضافة المحدد' : 'إرسال للموافقة'}{toPick.length ? ` (${toPick.length})` : ''}
        </button>
      </div>
      {add.error && <div className="err-text" style={{ marginBottom: 8 }}>{(add.error as any).message}</div>}

      {!q ? (
        <EmptyState text="اكتب اسم الصنف لعرض فواتير الشراء والبيع الخارجي التي فيها هذا الصنف" />
      ) : isLoading || (isFetching && !rows.length) ? <Spinner /> : !rows.length ? (
        <EmptyState text="لا توجد مشتريات بهذا الصنف في الفترة المحددة" />
      ) : (
        <div className="card tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  {free.length > 0 && <input type="checkbox" checked={allChecked} onChange={toggleAll} title="تحديد الكل" />}
                </th>
                <th>الصنف</th>
                <th>المستند</th>
                <th>التاريخ</th>
                <th>المورد</th>
                <th>سجّلها</th>
                <th className="num">الكمية</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((doc) => doc.items.map((it) => {
                const ref: ItemRef = { invoiceId: doc.invoiceId, productId: it.productId, kind: doc.kind };
                const k = refKey(ref);
                return (
                  <tr key={k} style={it.selected ? { background: 'var(--accent-soft)' } : undefined}>
                    <td>
                      {it.selected ? (
                        <span className="pill">{it.approved ? 'محدد' : 'بانتظار الموافقة'}</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={!!checked[k]}
                          onChange={(e) => setChecked((p) => ({ ...p, [k]: e.target.checked }))}
                        />
                      )}
                    </td>
                    <td><b>{it.productName}</b></td>
                    <td>{docLabel(doc.kind, doc.invoiceNo)}</td>
                    <td>{fmtDate(doc.date)}</td>
                    <td>{doc.supplierName || '—'}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{doc.buyer || '—'}</td>
                    <td className="num">{QTY(it.qty)}</td>
                    {isAdmin && (
                      <td>
                        {it.selected && (
                          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => remove.mutate(ref)}>
                            إزالة
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              }))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={6}>{rows.length} مستند</th>
                <th className="num">{QTY(totalQty)}</th>
                {isAdmin && <th></th>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        {isAdmin
          ? 'بعد الإضافة يُكتب المبلغ للوحدة أو النسبة لكل صنف من «الأصناف»، ثم ينتقل إلى الأرشيف.'
          : 'الأصناف المرسلة تنتظر موافقة المالك.'}
      </div>
    </>
  );
}
