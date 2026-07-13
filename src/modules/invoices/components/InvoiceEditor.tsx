'use client';

import { useEffect, useRef, useState } from 'react';
import { money, EGP, todayISO, QTY } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useNavigationGuard } from '@/lib/useNavigationGuard';
import { fieldNavKeyDown } from '@/lib/field-nav';
import { PageTitle, Field, Combobox, MoneyInput } from '@/components/common';
import { useAllParties } from '../../parties/hooks';
import { partiesApi } from '../../parties/api';
import { useAllProducts, useCreateProduct, useUpdateProduct, useLastPrices } from '../../products/hooks';
import { useAllWarehouses, useWarehouseStock } from '../../warehouses/hooks';
import { useAllTreasury } from '../../treasury/hooks';
import { ManifestEditor } from '../../manifests/components/ManifestEditor';
import { useCreateInvoice, useUpdateInvoice } from '../hooks';
import { invoicesApi } from '../api';
import { ProductCombobox } from '../../products/components/ProductCombobox';
import { PartyCombobox } from './PartyCombobox';
import { CommissionPicker } from './CommissionPicker';
import type { Invoice, InvoiceKind } from '../dtos';
import type { InvoiceDraft } from '../draftTypes';

interface Line { _key: number; productId: string; qty: string; price: string; }
let _nextKey = 0;
const blankLine = (): Line => ({ _key: _nextKey++, productId: '', qty: '', price: '' });
let _draftSeq = 0;
const newDraftId = () => `draft_${++_draftSeq}_${Date.now()}`;

interface Props {
  kind: InvoiceKind;
  onClose: () => void;
  /** when editing an existing invoice */
  invoice?: Invoice;
  onUpdated?: () => void;
  /** hydrate the whole form from a previously minimized draft */
  initialDraft?: InvoiceDraft;
  /** when provided, a "تصغير" button collapses the editor into the drafts dock */
  onMinimize?: (draft: InvoiceDraft) => void;
}

export function InvoiceEditor({ kind, onClose, invoice, onUpdated, initialDraft, onMinimize }: Props) {
  const d = initialDraft?.state;
  const { can } = useAuth();
  const editInvoiceId = invoice?.id ?? initialDraft?.invoiceId;
  const isEdit = !!editInvoiceId;
  const draftIdRef = useRef(initialDraft?.id ?? newDraftId());
  const role = kind === 'SALE' ? 'CLIENT' : 'SUPPLIER';
  const { data: parties } = useAllParties(role);
  const { data: products } = useAllProducts();
  const { data: warehouses } = useAllWarehouses();
  const { data: treasury } = useAllTreasury();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const [registering, setRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regUnit, setRegUnit] = useState('');
  const [regErr, setRegErr] = useState('');
  const registerProduct = () => {
    if (!regName.trim()) { setRegErr('اكتب اسم الصنف'); return; }
    setRegErr('');
    createProduct.mutate(
      { name: regName.trim(), unit: regUnit.trim() || undefined },
      { onSuccess: () => { setRegName(''); setRegUnit(''); setRegistering(false); }, onError: (e: any) => setRegErr(e.message) },
    );
  };

  const [no, setNo] = useState(d?.no ?? invoice?.no ?? '');
  const [date, setDate] = useState(d?.date ?? invoice?.date?.slice(0, 10) ?? todayISO());
  const [partyId, setPartyId] = useState(d?.partyId ?? invoice?.party?.id ?? '');
  const [directSale, setDirectSale] = useState(d?.directSale ?? false);
  const [directSaleLoading, setDirectSaleLoading] = useState(false);

  // "بيع مباشر" — skip picking a customer by silently using a shared system
  // party (created once, reused every time) instead.
  const toggleDirectSale = (on: boolean) => {
    setDirectSale(on);
    if (on) {
      setDirectSaleLoading(true);
      partiesApi.directSale()
        .then((p) => setPartyId(p.id))
        .finally(() => setDirectSaleLoading(false));
    } else {
      setPartyId('');
    }
  };

  // Auto-fill invoice number when party is selected (create mode only). Never clobber a
  // number the user already typed or that came back with a restored draft.
  useEffect(() => {
    if (!partyId || isEdit) return;
    invoicesApi.nextNo(partyId).then(({ no: n }) => setNo((cur) => cur || n)).catch(() => {});
  }, [partyId, isEdit]);
  const [warehouseId, setWarehouseId] = useState(d?.warehouseId ?? invoice?.warehouse?.id ?? '');
  const { data: stock } = useWarehouseStock(warehouseId || undefined);
  const stockByProduct = new Map((stock ?? []).map((r) => [r.productId, r]));
  const { data: lastPrices } = useLastPrices(kind);
  const lastPriceByProduct = new Map((lastPrices ?? []).map((r) => [r.productId, r]));
  const [treasuryId, setTreasuryId] = useState(d?.treasuryId ?? '');
  const [paid, setPaid] = useState(d?.paid ?? (invoice ? String(invoice.paid || '') : ''));
  const [discount, setDiscount] = useState(invoice?.discount ? String(invoice.discount) : '');
  const [fake, setFake] = useState(invoice?.fake ?? false);
  const [note, setNote] = useState(d?.note ?? invoice?.note ?? '');
  const [exchangeRate, setExchangeRate] = useState(d?.exchangeRate ?? (invoice?.exchangeRate ? String(invoice.exchangeRate) : ''));
  const [commissionAmount, setCommissionAmount] = useState(d?.commissionAmount ?? '');
  const [commissionPartyId, setCommissionPartyId] = useState(d?.commissionPartyId ?? '');
  const [lines, setLines] = useState<Line[]>(
    d?.lines?.length
      ? d.lines.map((l) => ({ _key: _nextKey++, productId: l.productId, qty: l.qty, price: l.price }))
      : invoice?.items.length
        ? invoice.items.map((it) => ({ _key: _nextKey++, productId: it.productId, qty: String(it.qty), price: String(it.price) }))
        : [blankLine()],
  );
  // A restored draft already carries its lines — don't re-inject pinned defaults over them.
  const [prefilled, setPrefilled] = useState(isEdit || !!initialDraft);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Invoice | null>(null);
  const [makeManifest, setMakeManifest] = useState(false);

  // prefill pinned lines for new invoices — which items pin depends on the invoice kind
  useEffect(() => {
    if (prefilled || !products) return;
    const pinned = products.data.filter((p) => (kind === 'SALE' ? p.pinSale : p.pinPurchase));
    if (pinned.length) setLines([...pinned.map((p) => ({ _key: _nextKey++, productId: p.id, qty: '', price: '' })), blankLine()]);
    setPrefilled(true);
  }, [products, prefilled, kind]);

  const isDirty = isEdit || !!partyId || lines.some((l) => !!(l.productId || l.qty || l.price));
  useNavigationGuard(isDirty);
  const handleClose = () => {
    if (isDirty && !window.confirm('في بيانات لم تُحفظ — هل تريد المغادرة بدون حفظ؟')) return;
    onClose();
  };

  // Snapshot the whole form into a serializable draft so it can be minimized and
  // restored later (even after navigating to another page).
  const buildDraft = (): InvoiceDraft => {
    const party = parties?.data.find((p) => p.id === partyId);
    const kindLabel = kind === 'SALE' ? 'بيع' : 'شراء';
    const who = party ? ` — ${party.name}` : directSale ? ' — بيع مباشر' : '';
    return {
      id: draftIdRef.current,
      kind,
      invoiceId: editInvoiceId,
      title: `فاتورة ${kindLabel}${no ? ` رقم ${no}` : ''}${who}`,
      updatedAt: Date.now(),
      state: {
        no, date, partyId, directSale, warehouseId, treasuryId, paid, note,
        exchangeRate, commissionAmount, commissionPartyId,
        lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price })),
      },
    };
  };
  const handleMinimize = () => onMinimize?.(buildDraft());

  const selectedParty = parties?.data.find((p) => p.id === partyId);
  const isUSD = selectedParty?.currency === 'USD';
  const cur = isUSD ? 'USD' : 'EGP';

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const disc = Math.min(Number(discount) || 0, total); // الخصم لا يتجاوز الإجمالي
  const netTotal = total - disc;
  const rate = Number(exchangeRate) || 0;
  const totalEgp = isUSD && rate > 0 ? total * rate : 0; // EGP equivalent of a USD invoice
  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const save = () => {
    setError('');
    const items = lines
      .filter((l) => l.productId && Number(l.qty) > 0)
      .map((l) => ({ productId: l.productId, qty: Number(l.qty), price: Number(l.price) || 0 }));
    if (!partyId) return setError('اختر الطرف');
    if (!warehouseId) return setError('اختر المخزن');
    if (items.length === 0) return setError('أضف صنفًا واحدًا على الأقل');
    if (!fake && Number(paid) > 0 && !treasuryId) return setError('اخترت مبلغ مدفوع — لازم تختار الخزنة اللي المبلغ خارج/داخل منها');
    if (!fake && isUSD && !(rate > 0)) return setError('فاتورة دولارية — اكتب سعر صرف الدولار اليوم');

    const usdRate = isUSD && rate > 0 ? { exchangeRate: rate } : {};

    if (isEdit) {
      updateInvoice.mutate(
        {
          id: editInvoiceId!,
          dto: {
            date, partyId, warehouseId, items,
            paid: fake ? 0 : Number(paid) || 0,
            discount: fake ? undefined : disc || undefined,
            fake,
            treasuryId: fake ? undefined : treasuryId || undefined,
            note: note || undefined,
            ...usdRate,
            ...(kind === 'PURCHASE' && Number(commissionAmount) > 0 && commissionPartyId
              ? { commissionAmount: Number(commissionAmount), commissionPartyId }
              : {}),
          },
        },
        {
          onSuccess: () => onUpdated?.(),
          onError: (e: any) => setError(e.message),
        },
      );
    } else {
      createInvoice.mutate(
        {
          kind, no: no.trim() || undefined, date, partyId, warehouseId, fake,
          items, paid: fake ? 0 : Number(paid) || 0, discount: fake ? undefined : disc || undefined, treasuryId: fake ? undefined : treasuryId || undefined, note: note || undefined,
          ...usdRate,
          ...(kind === 'PURCHASE' && Number(commissionAmount) > 0
            ? { commissionAmount: Number(commissionAmount) }
            : {}),
        },
        { onSuccess: (inv) => setSaved(inv), onError: (e: any) => setError(e.message) },
      );
    }
  };

  if (saved && makeManifest) {
    return (
      <ManifestEditor
        onClose={onClose}
        onCreated={onClose}
        initial={{
          clientName: saved.party?.name ?? '',
          items: saved.items.filter((it) => !it.product?.service).map((it) => ({ name: it.product?.name ?? '', qty: it.qty })),
        }}
      />
    );
  }

  if (saved) {
    return (
      <>
        <PageTitle title={`تم حفظ ${kind === 'SALE' ? 'فاتورة البيع' : 'فاتورة الشراء'} رقم ${saved.no} ✅`} />
        <div className="card" style={{ padding: 22 }}>
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>هل تريد عمل كشف عربية لهذه الفاتورة؟</p>
          <p className="muted" style={{ marginTop: -6 }}>سيتم نقل اسم العميل والأصناف تلقائيًا، وتكمل بيانات السائق والعربية.</p>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button className="btn btn-primary" onClick={() => setMakeManifest(true)}>نعم، اعمل كشف عربية</button>
            <button className="btn btn-ghost" onClick={onClose}>لا، تم</button>
          </div>
        </div>
      </>
    );
  }

  const isPending = isEdit ? updateInvoice.isPending : createInvoice.isPending;

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={handleClose}>→ رجوع لقائمة الفواتير</button>
        {onMinimize && (
          <button className="btn btn-ghost btn-sm" title="تصغير الفاتورة — تفضل مفتوحة وتقدر تكمّلها بعدين" onClick={handleMinimize}>🗕 تصغير</button>
        )}
      </div>
      <PageTitle title={isEdit ? `تعديل ${kind === 'SALE' ? 'فاتورة بيع' : 'فاتورة شراء'} رقم ${invoice?.no ?? no}` : kind === 'SALE' ? 'فاتورة بيع جديدة' : 'فاتورة شراء جديدة'} />
      <div className="card" onKeyDown={fieldNavKeyDown}>
        <div className="form-grid">
          {!isEdit && <Field label="رقم الفاتورة"><input value={no} onChange={(e) => setNo(e.target.value)} placeholder={partyId ? '…' : 'اختر العميل أولاً'} style={no ? { fontWeight: 700 } : {}} /></Field>}
          <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={kind === 'SALE' ? 'العميل' : 'المورد'}>
            {directSale ? (
              <span className="muted" style={{ fontSize: 13 }}>{directSaleLoading ? '...' : 'بيع مباشر — بدون عميل محدد'}</span>
            ) : (
              <PartyCombobox parties={parties?.data ?? []} value={partyId} onChange={setPartyId} role={role} />
            )}
            {kind === 'SALE' && !isEdit && (
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, fontWeight: 600, marginTop: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={directSale} onChange={(e) => toggleDirectSale(e.target.checked)} />
                بيع مباشر (بدون اختيار عميل)
              </label>
            )}
          </Field>
          <Field label="المخزن">
            <Combobox options={warehouses?.data ?? []} value={warehouseId} onChange={setWarehouseId} />
          </Field>
          <Field label="البيان (اختياري)" full><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <Field label="نوع الفاتورة" full>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, cursor: 'pointer', color: fake ? 'var(--debit)' : undefined }}>
              <input type="checkbox" checked={fake} onChange={(e) => setFake(e.target.checked)} />
              فاتورة وهمية (مستند فقط — مش هتتسجّل في الحسابات ولا الخزنة ولا المخزن)
            </label>
          </Field>
        </div>

        {fake && (
          <div style={{ padding: '6px 16px', background: 'var(--debit-bg, #fdecea)', borderRadius: 8, margin: '0 16px 8px', fontWeight: 700, fontSize: 13, color: 'var(--debit)' }}>
            ⚠️ فاتورة وهمية — بتتطبع كمستند بس، ومش بتأثّر على رصيد الطرف ولا الخزنة ولا المخزن ولا التقارير.
          </div>
        )}

        {isUSD && (
          <>
            <div style={{ padding: '6px 16px', background: 'var(--debit-bg)', borderRadius: 8, margin: '0 16px 8px', fontWeight: 700, fontSize: 13, color: 'var(--debit)' }}>
              $ فاتورة دولارية — جميع الأسعار بالدولار
            </div>
            <div className="form-grid">
              <Field label="سعر صرف الدولار اليوم (ج.م لكل $)">
                <MoneyInput value={exchangeRate} onChange={setExchangeRate} placeholder="مثلاً 50" />
              </Field>
              {rate > 0 && (
                <Field label="الإجمالي بالمصري بعد التحويل">
                  <div className="num" style={{ fontWeight: 800, padding: '10px 0' }}>{money(total, 'USD')} = {EGP(totalEgp)} ج.م</div>
                </Field>
              )}
            </div>
          </>
        )}
        <div className="tbl-wrap combo-table invoice-items">
          <table>
            <thead><tr><th>الكمية</th><th>الصنف</th><th>السعر {isUSD ? '($)' : '(ج.م)'}</th><th>الإجمالي</th><th></th></tr></thead>
            <tbody>
              {lines.map((l, i) => {
                const prod = l.productId ? products?.data.find((p) => p.id === l.productId) : undefined;
                const stockRow = prod && !prod.service ? stockByProduct.get(l.productId) : undefined;
                const lastPrice = prod ? lastPriceByProduct.get(l.productId) : undefined;
                const pinned = prod ? (kind === 'SALE' ? !!prod.pinSale : !!prod.pinPurchase) : false;
                return (
                  <tr key={l._key}>
                    <td><MoneyInput value={l.qty} onChange={(v) => setLine(i, { qty: v })} placeholder="0" style={{ width: 80 }} /></td>
                    <td style={{ minWidth: 320 }}>
                      <ProductCombobox
                        products={products?.data ?? []}
                        value={l.productId}
                        onChange={(id) => setLine(i, { productId: id })}
                      />
                      {prod && !prod.service && (
                        <div style={{ fontSize: 12, marginTop: 3, fontWeight: 700 }} className={(stockRow?.qty ?? 0) < 0 ? 'deb' : 'muted'}>
                          {warehouseId
                            ? `الرصيد بالمخزن: ${QTY(stockRow?.qty ?? 0)} ${stockRow?.unit || prod.unit || ''}`
                            : 'اختر المخزن لمعرفة الرصيد'}
                        </div>
                      )}
                    </td>
                    <td>
                      <MoneyInput value={l.price} onChange={(v) => setLine(i, { price: v })} placeholder="0" style={{ width: 110 }} />
                      {lastPrice && (
                        <div
                          className="muted"
                          style={{ fontSize: 12, marginTop: 3, cursor: 'pointer' }}
                          title="اضغط لاستخدام آخر سعر"
                          onClick={() => setLine(i, { price: String(lastPrice.price) })}
                        >
                          آخر سعر: {money(lastPrice.price, cur)}
                        </div>
                      )}
                    </td>
                    <td className="num">{money(Number(l.qty) * Number(l.price), cur)}</td>
                    <td style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {prod && (
                        <button
                          title={pinned ? 'إلغاء التثبيت كبند افتراضي' : `تثبيت — يظهر تلقائياً في كل فاتورة ${kind === 'SALE' ? 'بيع' : 'شراء'} جديدة`}
                          className="btn btn-ghost btn-sm"
                          style={{ opacity: pinned ? 1 : 0.35, fontSize: 15 }}
                          onClick={() => updateProduct.mutate({
                            id: prod.id,
                            dto: kind === 'SALE'
                              ? { pinSale: !pinned, service: !pinned || prod.service }
                              : { pinPurchase: !pinned, service: !pinned || prod.service },
                          })}
                        >📌</button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setLines((ls) => [...ls, blankLine()])}>+ إضافة صنف</button>
        </div>

        {!fake && (
        <div className="form-grid">
          <Field label={`خصم على الفاتورة${isUSD ? ' ($)' : ' (ج.م)'}`}><MoneyInput value={discount} onChange={setDiscount} placeholder="0.00" /></Field>
          <Field label="المدفوع نقدًا الآن"><MoneyInput value={paid} onChange={setPaid} placeholder="0.00" /></Field>
          <Field label="حساب الخزنة">
            <Combobox options={treasury?.data ?? []} value={treasuryId} onChange={setTreasuryId} />
          </Field>
        </div>
        )}

        {!fake && kind === 'PURCHASE' && can('invoices.commission') && (
          <div className="form-grid" style={{ borderTop: '1px solid var(--line-soft)' }}>
            <Field label="مبلغ commission"><MoneyInput value={commissionAmount} onChange={setCommissionAmount} placeholder="0.00" /></Field>
            <Field label="commission لصالح (تُضاف لرصيده)">
              <CommissionPicker value={commissionPartyId} onChange={setCommissionPartyId} />
            </Field>
          </div>
        )}

        <div className="page-title num" style={{ padding: '0 16px' }}>
          {disc > 0 ? <>الإجمالي: {money(total, cur)} · خصم: {money(disc, cur)} · <b>الصافي: {money(netTotal, cur)}</b></> : <>الإجمالي: {money(total, cur)}</>}
        </div>
        <div className="err-text" style={{ padding: '0 16px' }}>{error}</div>
        <div className="toolbar" style={{ padding: 16 }}>
          <button className="btn btn-primary" onClick={save} disabled={isPending}>
            {isPending ? '...' : isEdit ? 'حفظ التعديلات' : 'حفظ الفاتورة'}
          </button>
          {onMinimize && <button className="btn btn-ghost" onClick={handleMinimize}>🗕 تصغير</button>}
          <button className="btn btn-ghost" onClick={handleClose}>إلغاء</button>
        </div>
      </div>
    </>
  );
}
