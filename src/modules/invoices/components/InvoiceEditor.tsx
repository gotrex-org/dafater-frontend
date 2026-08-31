'use client';

import { useEffect, useRef, useState } from 'react';
import { money, EGP, todayISO, QTY } from '@/lib/format';
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

interface Line {
  _key: number; productId: string; qty: string; price: string;
  freight: string; freightTreasuryId: string; freightNote: string; // ناولون — خزنة + بيان
  tea: string; teaTreasuryId: string; teaNote: string;             // شاي — خزنة + بيان
  commQty: string; commPrice: string; commPartyId: string; // عمولة = عدد × سعر لمين
  showFreight?: boolean; showTea?: boolean; showComm?: boolean; // أي إضافات مفعّلة من زر الثلاث نقاط
  bnd?: boolean;
}
let _nextKey = 0;
const blankLine = (): Line => ({ _key: _nextKey++, productId: '', qty: '', price: '', freight: '', freightTreasuryId: '', freightNote: '', tea: '', teaTreasuryId: '', teaNote: '', commQty: '', commPrice: '', commPartyId: '' });
const bndBlank = (): Line => ({ ...blankLine(), bnd: true }); // بند إضافي (خدمة/رسوم) منفصل عن الأصناف
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
  // توكن يتزوّد مع كل تبديل — عشان لو اليوزر شال العلامة قبل ما الطلب يرجع، نتجاهل النتيجة القديمة
  const directSaleToken = useRef(0);

  // "بيع مباشر" — skip picking a customer by silently using a shared system
  // party (created once, reused every time) instead.
  const toggleDirectSale = (on: boolean) => {
    const token = ++directSaleToken.current;
    setDirectSale(on);
    if (on) {
      setDirectSaleLoading(true);
      partiesApi.directSale()
        .then((p) => { if (token === directSaleToken.current) setPartyId(p.id); })
        .finally(() => { if (token === directSaleToken.current) setDirectSaleLoading(false); });
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
  const [discount, setDiscount] = useState(d?.discount ?? (invoice?.discount ? String(invoice.discount) : ''));
  const [fake, setFake] = useState(d?.fake ?? invoice?.fake ?? false);
  const [note, setNote] = useState(d?.note ?? invoice?.note ?? '');
  const [exchangeRate, setExchangeRate] = useState(d?.exchangeRate ?? (invoice?.exchangeRate ? String(invoice.exchangeRate) : ''));
  const [lines, setLines] = useState<Line[]>(
    d?.lines?.length
      ? d.lines.map((l) => ({ _key: _nextKey++, productId: l.productId, qty: l.qty, price: l.price, bnd: l.bnd,
          freight: l.freight ?? '', freightTreasuryId: l.freightTreasuryId ?? '', freightNote: l.freightNote ?? '',
          tea: l.tea ?? '', teaTreasuryId: l.teaTreasuryId ?? '', teaNote: l.teaNote ?? '',
          commQty: l.commQty ?? '', commPrice: l.commPrice ?? '', commPartyId: l.commPartyId ?? '',
          showFreight: !!l.freight, showTea: !!l.tea, showComm: !!(l.commQty || l.commPartyId) }))
      : invoice?.items.length
        ? invoice.items.map((it) => ({ _key: _nextKey++, productId: it.productId, qty: String(it.qty), price: String(it.price),
            freight: it.freight ? String(it.freight) : '', freightTreasuryId: it.freightTreasury?.id ?? '', freightNote: it.freightNote ?? '',
            tea: it.tea ? String(it.tea) : '', teaTreasuryId: it.teaTreasury?.id ?? '', teaNote: it.teaNote ?? '',
            commQty: it.commissionQty ? String(it.commissionQty) : '', commPrice: it.commissionPrice ? String(it.commissionPrice) : '',
            commPartyId: it.commissionParty?.id ?? '',
            showFreight: !!it.freight, showTea: !!it.tea, showComm: !!(it.commissionQty || it.commissionParty) }))
        : [blankLine()],
  );
  // A restored draft already carries its lines — don't re-inject pinned defaults over them.
  const [prefilled, setPrefilled] = useState(isEdit || !!initialDraft);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Invoice | null>(null);
  const [makeManifest, setMakeManifest] = useState(false);
  const [menuFor, setMenuFor] = useState<number | null>(null); // زر الثلاث نقاط المفتوح (حسب _key)
  const [showExtras, setShowExtras] = useState<boolean>(!!(d?.discount && Number(d.discount) > 0) || !!invoice?.discount);

  // prefill pinned lines for new invoices — which items pin depends on the invoice kind
  useEffect(() => {
    if (prefilled || !products) return;
    const pinned = products.data.filter((p) => (kind === 'SALE' ? p.pinSale : p.pinPurchase));
    // Pinned defaults become extra "بنود" that sit AFTER the products (a blank product line first).
    if (pinned.length) setLines([blankLine(), ...pinned.map((p) => ({ ...blankLine(), productId: p.id, bnd: true }))]);
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
        no, date, partyId, directSale, warehouseId, treasuryId, paid, discount, fake, note,
        exchangeRate,
        lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price, bnd: l.bnd, freight: l.freight, freightTreasuryId: l.freightTreasuryId, freightNote: l.freightNote, tea: l.tea, teaTreasuryId: l.teaTreasuryId, teaNote: l.teaNote, commQty: l.commQty, commPrice: l.commPrice, commPartyId: l.commPartyId })),
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
      .map((l) => ({
        productId: l.productId, qty: Number(l.qty), price: Number(l.price) || 0,
        freight: Number(l.freight) || 0,
        ...(Number(l.freight) > 0 && l.freightTreasuryId ? { freightTreasuryId: l.freightTreasuryId } : {}),
        ...(Number(l.freight) > 0 && l.freightNote.trim() ? { freightNote: l.freightNote.trim() } : {}),
        tea: Number(l.tea) || 0,
        ...(Number(l.tea) > 0 && l.teaTreasuryId ? { teaTreasuryId: l.teaTreasuryId } : {}),
        ...(Number(l.tea) > 0 && l.teaNote.trim() ? { teaNote: l.teaNote.trim() } : {}),
        commissionQty: Number(l.commQty) || 0,
        commissionPrice: Number(l.commPrice) || 0,
        ...(l.commPartyId && Number(l.commQty) > 0 && Number(l.commPrice) > 0 ? { commissionPartyId: l.commPartyId } : {}),
      }));
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
        },
        // Purchase invoices never make a vehicle manifest — just close. Sales offer it.
        { onSuccess: (inv) => { if (kind === 'SALE') setSaved(inv); else onClose(); }, onError: (e: any) => setError(e.message) },
      );
    }
  };

  if (saved && makeManifest) {
    return (
      <ManifestEditor
        onClose={onClose}
        onCreated={onClose}
        initial={{
          // الربط بالفاتورة هو اللي بيخلّي العربية تظهر كتاب جوّاها (ManifestTabs)
          invoiceId: saved.id,
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
          {!isEdit && (
            <Field label="رقم الفاتورة">
              <input
                value={no}
                readOnly
                placeholder=""
                title="رقم تلقائي — يظهر بعد اختيار الطرف"
                style={{ fontWeight: 700, textAlign: 'center', width: `${Math.max((no?.length || 0) + 2, 4)}ch` }}
              />
              {!partyId && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>تلقائي بعد اختيار {role === 'CLIENT' ? 'العميل' : 'المورد'}</div>}
            </Field>
          )}
          <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 'fit-content', maxWidth: '100%' }} /></Field>
          <Field label={kind === 'SALE' ? 'العميل' : 'المورد'}>
            {directSale ? (
              <span className="muted" style={{ fontSize: 13 }}>{directSaleLoading ? '...' : 'بيع مباشر — بدون عميل محدد'}</span>
            ) : (
              <PartyCombobox parties={parties?.data ?? []} value={partyId} onChange={setPartyId} role={role} />
            )}
            {!directSale && selectedParty && (
              <div style={{ fontSize: 12.5, marginTop: 4, fontWeight: 700 }}>
                رصيده الحالي: <span className={(selectedParty.balance ?? 0) >= 0 ? 'deb' : 'cre'}>{money(Math.abs(selectedParty.balance ?? 0), cur)} {(selectedParty.balance ?? 0) >= 0 ? 'عليه' : 'له'}</span>
              </div>
            )}
            {kind === 'SALE' && !isEdit && (
              <label className="check-inline" style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>
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
            <label className="check-inline" style={{ fontWeight: 700, color: fake ? 'var(--debit)' : undefined }}>
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
                if (l.bnd) return null; // البنود الإضافية ليها قسم منفصل تحت
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
                      {(() => {
                        const extras = (Number(l.freight) || 0) + (Number(l.tea) || 0) + (Number(l.commQty) || 0) * (Number(l.commPrice) || 0);
                        const anyExtra = l.showFreight || l.showTea || l.showComm;
                        if (!anyExtra) return null;
                        const netUnit = Number(l.qty) > 0 ? Number(l.price) + extras / Number(l.qty) : Number(l.price);
                        return (
                          <div style={{ marginTop: 6, display: 'grid', gap: 4, padding: 6, background: 'var(--line-soft)', borderRadius: 8, fontSize: 12 }}>
                            {l.showFreight && (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ minWidth: 42, fontWeight: 700 }}>ناولون</span>
                                <MoneyInput value={l.freight} onChange={(v) => setLine(i, { freight: v })} placeholder="مبلغ" style={{ width: 78 }} />
                                <span className="muted" style={{ fontSize: 11 }}>من خزنة</span>
                                <div style={{ width: 104 }}>
                                  <Combobox options={treasury?.data ?? []} value={l.freightTreasuryId} onChange={(id) => setLine(i, { freightTreasuryId: id })} placeholder="اختر الخزنة" />
                                </div>
                                <input value={l.freightNote} onChange={(e) => setLine(i, { freightNote: e.target.value })} placeholder="بيان" style={{ width: 120, padding: '7px 9px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
                                <button className="btn btn-ghost btn-sm" style={{ marginInlineStart: 'auto', color: 'var(--debit)' }} onClick={() => setLine(i, { showFreight: false, freight: '', freightTreasuryId: '', freightNote: '' })}>×</button>
                              </div>
                            )}
                            {l.showTea && (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ minWidth: 42, fontWeight: 700 }}>شاي</span>
                                <MoneyInput value={l.tea} onChange={(v) => setLine(i, { tea: v })} placeholder="مبلغ" style={{ width: 78 }} />
                                <span className="muted" style={{ fontSize: 11 }}>من خزنة</span>
                                <div style={{ width: 104 }}>
                                  <Combobox options={treasury?.data ?? []} value={l.teaTreasuryId} onChange={(id) => setLine(i, { teaTreasuryId: id })} placeholder="اختر الخزنة" />
                                </div>
                                <input value={l.teaNote} onChange={(e) => setLine(i, { teaNote: e.target.value })} placeholder="بيان" style={{ width: 120, padding: '7px 9px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
                                <button className="btn btn-ghost btn-sm" style={{ marginInlineStart: 'auto', color: 'var(--debit)' }} onClick={() => setLine(i, { showTea: false, tea: '', teaTreasuryId: '', teaNote: '' })}>×</button>
                              </div>
                            )}
                            {l.showComm && (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ minWidth: 42, fontWeight: 700 }}>عمولة</span>
                                <MoneyInput value={l.commQty} onChange={(v) => setLine(i, { commQty: v })} placeholder="عدد" style={{ width: 60 }} />
                                <span className="muted">×</span>
                                <MoneyInput value={l.commPrice} onChange={(v) => setLine(i, { commPrice: v })} placeholder="سعر" style={{ width: 70 }} />
                                <span className="num" style={{ fontWeight: 700 }}>= {money((Number(l.commQty) || 0) * (Number(l.commPrice) || 0), cur)}</span>
                                <div style={{ minWidth: 150, flex: 1 }}>
                                  <CommissionPicker value={l.commPartyId} onChange={(id) => setLine(i, { commPartyId: id })} />
                                </div>
                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--debit)' }} onClick={() => setLine(i, { showComm: false, commQty: '', commPrice: '', commPartyId: '' })}>×</button>
                              </div>
                            )}
                            {extras > 0 && Number(l.qty) > 0 && (
                              <div className="muted" style={{ fontSize: 11.5 }}>صافي سعر الوحدة عليك: <b>{money(netUnit, cur)}</b></div>
                            )}
                          </div>
                        );
                      })()}
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
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'relative' }}>
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
                        <button
                          className="btn btn-ghost btn-sm"
                          title="إضافة كوميشن / ناولون / شاي على الصنف"
                          style={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }}
                          onClick={() => setMenuFor((k) => (k === l._key ? null : l._key))}
                        >⋮</button>
                        {menuFor === l._key && (
                          <div style={{ position: 'absolute', top: '100%', insetInlineEnd: 0, zIndex: 20, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.12)', padding: 4, display: 'grid', gap: 2, minWidth: 130 }}>
                            <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => { setLine(i, { showComm: true }); setMenuFor(null); }}>➕ كوميشن</button>
                            <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => { setLine(i, { showFreight: true }); setMenuFor(null); }}>➕ ناولون</button>
                            <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => { setLine(i, { showTea: true }); setMenuFor(null); }}>➕ شاي</button>
                          </div>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>×</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setLines((ls) => {
            // keep new product lines above the بنود block in the array
            const idx = ls.findIndex((l) => l.bnd);
            const nl = blankLine();
            return idx === -1 ? [...ls, nl] : [...ls.slice(0, idx), nl, ...ls.slice(idx)];
          })}>+ إضافة صنف</button>
        </div>

        {/* البنود الإضافية — قسم منفصل عن الأصناف، بحجم أصغر ولون قريب من سطح الكارت */}
        <div style={{ margin: '4px 16px 14px', padding: 9, borderRadius: 10, background: 'var(--line-soft)', border: '1px solid var(--line)' }}>
          <div style={{ fontWeight: 700, fontSize: 11.5, marginBottom: 6, color: 'var(--ink-soft)' }}>🧾 بنود إضافية (خدمات ورسوم)</div>
          <div style={{ display: 'grid', gap: 4 }}>
            {lines.map((l, i) => {
              if (!l.bnd) return null;
              return (
                <div key={l._key} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface)', borderRadius: 6, padding: '4px 6px', fontSize: 12 }}>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <ProductCombobox products={products?.data ?? []} value={l.productId} onChange={(id) => setLine(i, { productId: id })} />
                  </div>
                  <MoneyInput value={l.qty} onChange={(v) => setLine(i, { qty: v })} placeholder="كمية" style={{ width: 56 }} />
                  <span className="muted" style={{ fontSize: 11 }}>×</span>
                  <MoneyInput value={l.price} onChange={(v) => setLine(i, { price: v })} placeholder="سعر" style={{ width: 78 }} />
                  <span className="num" style={{ minWidth: 74, fontWeight: 700, textAlign: 'end', fontSize: 12 }}>{money(Number(l.qty) * Number(l.price), cur)}</span>
                  <button className="btn btn-danger btn-sm" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>×</button>
                </div>
              );
            })}
            {!lines.some((l) => l.bnd) && <div className="muted" style={{ fontSize: 11.5 }}>لا توجد بنود إضافية</div>}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 6, fontSize: 12 }} onClick={() => setLines((ls) => [...ls, bndBlank()])}>+ بند إضافي</button>
        </div>

        {!fake && (
        <div className="form-grid">
          <Field label="المدفوع نقدًا الآن"><MoneyInput value={paid} onChange={setPaid} placeholder="0.00" /></Field>
          <Field label="حساب الخزنة">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ flex: 1 }}><Combobox options={treasury?.data ?? []} value={treasuryId} onChange={setTreasuryId} /></div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                title="خصم على الفاتورة"
                style={{ fontSize: 17, fontWeight: 800, lineHeight: 1, padding: '6px 8px' }}
                onClick={() => setShowExtras((s) => !s)}
              >⋮</button>
            </div>
          </Field>
          {showExtras && (
            <Field label={`خصم على الفاتورة${isUSD ? ' ($)' : ' (ج.م)'}`}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <MoneyInput value={discount} onChange={setDiscount} placeholder="0.00" />
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--debit)' }} onClick={() => { setShowExtras(false); setDiscount(''); }}>×</button>
              </div>
            </Field>
          )}
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
