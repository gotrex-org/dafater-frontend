'use client';

import { useMemo, useState } from 'react';
import { EGP } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { Combobox, Field, MoneyInput, Spinner } from '@/components/common';
import { useCreatePriceList, usePriceLists, useSupplierProducts, useUpdatePriceList } from '../hooks';
import type { Partner, PriceList } from '../dtos';

/** اسم المورد المحدد للاسم. */
const supplierName = (p: Partner) => p.suppliers[0]?.name ?? 'المورد';

/** بداية الأسبوع (السبت) الذي يقع فيه اليوم — الأسبوع في مصر يبدأ السبت. */
function weekStartISO() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  return d.toLocaleDateString('en-CA');
}

/** آخر يوم في الأسبوع الذي يبدأ في `start` (سبعة أيام، والنهاية داخلة). */
function weekEndFor(start: string) {
  const d = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return start;
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/**
 * قوائم أسعار المورد. لكل قائمة فترة (من تاريخ إلى تاريخ) وأسعار شراء للأصناف.
 * الفترات لا تتداخل، والقوائم السابقة محفوظة لأن الحسابات القديمة تعتمد عليها،
 * لذلك لا يوجد حذف.
 */
export function PriceListsPanel({ partner }: { partner: Partner }) {
  const { can, user } = useAuth();
  const canEdit = can('settlement.prices');
  const isAdmin = !!user?.admin;
  const { data: lists, isLoading } = usePriceLists(partner.id);
  const [editing, setEditing] = useState<PriceList | 'new' | null>(null);

  if (editing) {
    return (
      <PriceListForm
        partner={partner}
        list={editing === 'new' ? null : editing}
        onDone={() => setEditing(null)}
      />
    );
  }

  return (
    <>
      {canEdit && (
        <div className="toolbar">
          <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
            + قائمة أسعار جديدة
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            القوائم السابقة محفوظة لأن الحسابات القديمة تعتمد عليها
          </span>
        </div>
      )}

      {isLoading ? <Spinner /> : !lists?.length ? (
        <div className="card" style={{ padding: 16 }}>
          <b>لا توجد قوائم أسعار لهذا المورد بعد.</b>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {canEdit
              ? 'ابدأ بأول قائمة: حدد تاريخ البداية والنهاية، ثم أضف الأصناف وسعر شراء كل صنف.'
              : 'لم تُسجل قوائم أسعار بعد.'}
          </div>
        </div>
      ) : (
        lists.map((pl) => (
          <div key={pl.id} className="card tbl-wrap" style={{ marginBottom: 12 }}>
            <div className="toolbar" style={{ padding: '10px 12px', marginBottom: 0 }}>
              <b>من {pl.weekStart} إلى {pl.weekEnd}</b>
              {pl.latest && <span className="pill">أحدث فترة</span>}
              <span className="muted" style={{ fontSize: 12 }}>{pl.itemCount} صنف</span>
              {pl.note && <span className="muted" style={{ fontSize: 12 }}>· {pl.note}</span>}
              {canEdit && (pl.latest || isAdmin) && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginInlineStart: 'auto' }}
                  onClick={() => setEditing(pl)}
                >
                  تعديل
                </button>
              )}
            </div>
            <table>
              <thead>
                <tr><th>الصنف</th><th className="num">سعر الشراء</th></tr>
              </thead>
              <tbody>
                {pl.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.productName}</td>
                    <td className="num">{EGP(it.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </>
  );
}

interface Row { key: number; productId: string; price: string }

let rowSeq = 0;
const blankRow = (): Row => ({ key: ++rowSeq, productId: '', price: '' });

/**
 * نموذج القائمة: الفترة، ثم صفوف الأصناف (اسم الصنف وسعره بجانبه) مع إضافة
 * صفوف حسب الحاجة. الأصناف المعروضة هي أصناف المورد المحدد فقط.
 *
 * عند التعديل تُرسل صفوف النموذج فقط، والخدمة تُحدّث المُرسل ولا تمسح الباقي،
 * حتى لا يضيف تعديل سعر صنف أسعاراً لأصناف مستبعدة.
 */
function PriceListForm(
  { partner, list, onDone }: { partner: Partner; list: PriceList | null; onDone: () => void },
) {
  const { user } = useAuth();
  const isAdmin = !!user?.admin;
  // القائمة تخص مورد الاسم المحدد، وأصنافها تُقرأ من مشترياته
  const supplierId = list?.supplier.id ?? partner.suppliers[0]?.id ?? '';
  const { data: products, isLoading } = useSupplierProducts(partner.id, supplierId);
  const create = useCreatePriceList(partner.id);
  const update = useUpdatePriceList(partner.id);

  const [start, setStart] = useState(list?.weekStart ?? weekStartISO());
  const [end, setEnd] = useState(list?.weekEnd ?? weekEndFor(list?.weekStart ?? weekStartISO()));
  const [note, setNote] = useState(list?.note ?? '');
  const [rows, setRows] = useState<Row[]>(
    list?.items.length
      ? list.items.map((i) => ({ key: ++rowSeq, productId: i.productId, price: String(i.price) }))
      : [blankRow()],
  );
  const [removed, setRemoved] = useState<string[]>([]);
  const [error, setError] = useState('');

  const options = useMemo(
    () => (products ?? []).map((p) => ({ id: p.id, name: p.name })),
    [products],
  );
  const productById = useMemo(
    () => new Map((products ?? []).map((p) => [p.id, p])),
    [products],
  );

  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () => setRows((prev) => [...prev, blankRow()]);

  const dropRow = (key: number) =>
    setRows((prev) => {
      const row = prev.find((r) => r.key === key);
      // عند التعديل، الصنف المحذوف من القائمة يُرسل صريحاً ليُحذف من الخدمة
      if (list && row?.productId && list.items.some((i) => i.productId === row.productId)) {
        setRemoved((rm) => [...rm, row.productId]);
      }
      const next = prev.filter((r) => r.key !== key);
      return next.length ? next : [blankRow()];
    });

  /** السعر المقترح للصنف: سعر آخر قائمة، وإلا آخر سعر شراء بالجنيه. */
  const suggest = (productId: string) => {
    const p = productById.get(productId);
    if (!p) return '';
    const v = p.lastListPrice ?? p.lastPurchasePrice;
    return v && v > 0 ? String(v) : '';
  };

  const filled = rows.filter((r) => r.productId && Number(r.price) > 0);

  const submit = () => {
    if (!start || !end) return setError('حدد تاريخ البداية والنهاية');
    if (end < start) return setError('تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساوياً له');
    if (!filled.length) return setError('أضف صنفاً واحداً على الأقل مع سعره');
    const ids = filled.map((r) => r.productId);
    if (ids.length !== new Set(ids).size) return setError('يوجد صنف مكرر في القائمة');
    if (!list && !supplierId) return setError('لا يوجد مورد محدد. حدده من إعدادات التصفية');
    setError('');

    const items = filled.map((r) => ({ productId: r.productId, price: Number(r.price) }));
    if (list) {
      update.mutate(
        {
          id: list.id,
          dto: {
            weekStart: start, weekEnd: end, note: note || undefined, items,
            removeProductIds: removed.length ? removed : undefined,
          },
        },
        { onSuccess: onDone, onError: (e: any) => setError(e.message) },
      );
    } else {
      create.mutate(
        { supplierId, weekStart: start, weekEnd: end, note: note || undefined, items },
        { onSuccess: onDone, onError: (e: any) => setError(e.message) },
      );
    }
  };

  const busy = create.isPending || update.isPending;
  const lockDates = !!list && !isAdmin;

  return (
    <div className="card" style={{ padding: 16 }}>
      <b style={{ display: 'block', marginBottom: 10 }}>
        {list
          ? `تعديل قائمة ${list.weekStart} → ${list.weekEnd}`
          : `قائمة أسعار جديدة — ${supplierName(partner)}`}
      </b>

      {list && (
        <div style={{ fontSize: 12, marginBottom: 10, color: 'var(--debit)' }}>
          تنبيه: تعديل القائمة يغيّر حسابات العربيات التي تقرأ منها.
        </div>
      )}

      <div className="form-grid">
        <Field label="من تاريخ">
          <input
            type="date"
            value={start}
            disabled={lockDates}
            onChange={(e) => {
              setStart(e.target.value);
              // النهاية تتبع البداية تلقائياً حتى يتم تعديلها يدوياً
              if (!list) setEnd(weekEndFor(e.target.value));
            }}
          />
        </Field>
        <Field label="إلى تاريخ">
          <input type="date" value={end} disabled={lockDates} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <Field label="ملاحظة">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" />
        </Field>
      </div>
      {lockDates && (
        <div className="muted" style={{ fontSize: 11, marginTop: -4 }}>
          تعديل تواريخ الفترة للمالك فقط.
        </div>
      )}

      <div style={{ marginTop: 14, marginBottom: 6, fontWeight: 700, fontSize: 13 }}>
        الأصناف وأسعارها
      </div>

      {isLoading ? <Spinner /> : !products?.length ? (
        <div className="muted" style={{ fontSize: 13 }}>
          لا توجد أصناف مشتراة من {supplierName(partner)} بعد.
        </div>
      ) : (
        <>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '55%' }}>اسم الصنف</th>
                  <th className="num" style={{ width: '30%' }}>السعر</th>
                  <th style={{ width: '15%' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = productById.get(r.productId);
                  return (
                    <tr key={r.key}>
                      <td>
                        <Combobox
                          options={options}
                          value={r.productId}
                          onChange={(id) =>
                            setRow(r.key, { productId: id, price: r.price || suggest(id) })
                          }
                          placeholder="اختر الصنف"
                        />
                      </td>
                      <td className="num">
                        <MoneyInput
                          value={r.price}
                          onChange={(raw) => setRow(r.key, { price: raw })}
                          placeholder="0.00"
                          style={{ maxWidth: 130 }}
                        />
                        {p && p.lastPurchasePrice === null && p.lastPurchaseCurrency === 'USD' && (
                          <div className="muted" style={{ fontSize: 10 }}>
                            آخر شراء بالدولار بدون سعر صرف. اكتب السعر بالجنيه
                          </div>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => dropRow(r.key)}>×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="toolbar" style={{ marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={addRow}>+ صنف</button>
            <span className="muted" style={{ fontSize: 12 }}>
              {filled.length} صنف بسعر · الأصناف بدون سعر لن تُضاف إلى القائمة
            </span>
          </div>
        </>
      )}

      {error && <div className="err-text" style={{ marginTop: 8 }}>{error}</div>}

      <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
        <button className="btn btn-primary" disabled={busy} onClick={submit}>
          {busy ? '...' : list ? 'حفظ التعديل' : 'حفظ القائمة'}
        </button>
        <button className="btn btn-ghost" onClick={onDone}>إلغاء</button>
      </div>
    </div>
  );
}
