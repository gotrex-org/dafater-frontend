'use client';

import { useEffect, useState } from 'react';
import { money, EGP, todayISO } from '@/lib/format';
import { useNavigationGuard } from '@/lib/useNavigationGuard';
import { fieldNavKeyDown } from '@/lib/field-nav';
import { PageTitle, Field, Combobox, MoneyInput } from '@/components/common';
import { useAllParties } from '../../parties/hooks';
import { useAllProducts, useLastPrices } from '../../products/hooks';
import { useAllTreasury } from '../../treasury/hooks';
import { useChargeTypes } from '../../charge-types/hooks';
import { ProductCombobox } from '../../products/components/ProductCombobox';
import { CommissionPicker } from '../../invoices/components/CommissionPicker';
import { PartyCombobox } from '../../invoices/components/PartyCombobox';
import { ManifestEditor } from '../../manifests/components/ManifestEditor';
import { useCreateDeal, useUpdateDeal } from '../hooks';
import { dealsApi } from '../api';
import type { Deal } from '../dtos';

// نفس شكل فاتورة البيع ومعاملاتها: جدول أصناف (تجارة) وجدول بنود شحن منفصل (شحن)،
// والفرق إن كل صنف ليه سعر شراء من المورد وسعر بيع للعميل.
interface Line {
  _key: number; productId: string; qty: string; buyPrice: string; sellPrice: string;
  freight: string; freightTreasuryId: string; freightNote: string; // ناولون خارجي
  tea: string; teaTreasuryId: string; teaNote: string;             // شاي
  commQty: string; commPrice: string; commPartyId: string;         // عمولة = عدد × سعر لمين
  showFreight?: boolean; showTea?: boolean; showComm?: boolean;
}
// سطر بند شحن (نولون/تحميل/شفتنة…) — على العميل، ولا يؤثر على المخزون.
interface ChargeLine { _key: number; chargeTypeId: string; qty: string; price: string; note: string; manifestId?: string }
let _dk = 0;
const blank = (): Line => ({ _key: _dk++, productId: '', qty: '', buyPrice: '', sellPrice: '', freight: '', freightTreasuryId: '', freightNote: '', tea: '', teaTreasuryId: '', teaNote: '', commQty: '', commPrice: '', commPartyId: '' });
const blankCharge = (chargeTypeId = ''): ChargeLine => ({ _key: _dk++, chargeTypeId, qty: '1', price: '', note: '' });
const num = (s: string) => Number(s) || 0;

export function DealEditor({ onClose, initialDeal }: { onClose: () => void; initialDeal?: Deal }) {
  const isEdit = !!initialDeal;
  const { data: clients } = useAllParties('CLIENT');
  const { data: suppliers } = useAllParties('SUPPLIER');
  const { data: products } = useAllProducts();
  const { data: treasury } = useAllTreasury();
  const { data: chargeTypes } = useChargeTypes();
  const { data: lastSale } = useLastPrices('SALE');
  const { data: lastBuy } = useLastPrices('PURCHASE');
  const lastSaleBy = new Map((lastSale ?? []).map((r) => [r.productId, r]));
  const lastBuyBy = new Map((lastBuy ?? []).map((r) => [r.productId, r]));
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();

  const [date, setDate] = useState(() => initialDeal ? initialDeal.date.split('T')[0] : todayISO());
  const [no, setNo] = useState(() => initialDeal?.no ?? '');
  const [clientId, setClientId] = useState(() => initialDeal?.client?.id ?? '');
  const [supplierId, setSupplierId] = useState(() => initialDeal?.supplier?.id ?? '');
  const [treasuryId, setTreasuryId] = useState(() => initialDeal?.treasury?.id ?? '');
  const [paidIn, setPaidIn] = useState(() => initialDeal?.paidIn ? String(initialDeal.paidIn) : '');
  const [paidOut, setPaidOut] = useState(() => initialDeal?.paidOut ? String(initialDeal.paidOut) : '');
  const [note, setNote] = useState(() => initialDeal?.note ?? '');
  const [exchangeRate, setExchangeRate] = useState(() => initialDeal?.exchangeRate ? String(initialDeal.exchangeRate) : '');
  // ناولون العملية القديم (قبل جدول بنود الشحن) — يظهر فقط على العمليات المسجلة به.
  const [nawlon, setNawlon] = useState(() => initialDeal?.nawlon ? String(initialDeal.nawlon) : '');

  // رقم تلقائي بعد اختيار العميل (في الإضافة فقط)
  useEffect(() => {
    if (!clientId || isEdit) return;
    dealsApi.nextNo(clientId).then(({ no: n }) => setNo(n)).catch(() => {});
  }, [clientId, isEdit]);

  const [lines, setLines] = useState<Line[]>(() =>
    initialDeal?.items.length
      ? initialDeal.items.map((it) => ({
          _key: _dk++,
          productId: it.product?.id ?? '',
          qty: String(it.qty),
          buyPrice: String(it.buyPrice ?? 0),
          sellPrice: String(it.price),
          freight: it.freight ? String(it.freight) : '', freightTreasuryId: it.freightTreasury?.id ?? '', freightNote: it.freightNote ?? '',
          tea: it.tea ? String(it.tea) : '', teaTreasuryId: it.teaTreasury?.id ?? '', teaNote: it.teaNote ?? '',
          commQty: it.commissionQty ? String(it.commissionQty) : '', commPrice: it.commissionPrice ? String(it.commissionPrice) : '', commPartyId: it.commissionParty?.id ?? '',
          showFreight: !!it.freight, showTea: !!it.tea, showComm: !!(it.commissionQty || it.commissionParty),
        }))
      : [blank()]
  );
  const [charges, setCharges] = useState<ChargeLine[]>(() =>
    (initialDeal?.charges ?? []).map((c) => ({
      _key: _dk++, chargeTypeId: c.chargeType?.id ?? '', qty: String(c.qty), price: String(c.price),
      note: c.note ?? '', manifestId: c.manifest?.id,
    })),
  );
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ dealId: string; clientName: string; items: { name: string; qty: number }[] } | null>(null);
  const [makeManifest, setMakeManifest] = useState(false);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const setCharge = (i: number, patch: Partial<ChargeLine>) =>
    setCharges((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const selSupplier = suppliers?.data.find((s) => s.id === supplierId);
  const selClient = clients?.data.find((c) => c.id === clientId);
  const supplierIsUSD = selSupplier?.currency === 'USD';
  const rate = num(exchangeRate);

  // اختيار صنف يملأ السعرين تلقائياً بنفس قواعد الفواتير، والسعر المكتوب لا يُمسح:
  //   البيع  ← آخر سعر بيع، وإلا السعر الثابت.
  //   الشراء ← السعر الثابت، وإلا آخر سعر شراء (للمورد بالجنيه فقط، لأن أسعار الفواتير بالجنيه).
  const pickProduct = (i: number, id: string) => {
    const p = products?.data.find((x) => x.id === id);
    const pos = (v?: number) => (v && v > 0 ? v : undefined);
    const sell = pos(lastSaleBy.get(id)?.price) ?? pos(p?.salePrice);
    const buy = supplierIsUSD ? undefined : pos(p?.purchasePrice) ?? pos(lastBuyBy.get(id)?.price);
    setLines((ls) => ls.map((l, idx) => {
      if (idx !== i) return l;
      return {
        ...l, productId: id,
        sellPrice: num(l.sellPrice) > 0 || sell === undefined ? l.sellPrice : String(sell),
        buyPrice: num(l.buyPrice) > 0 || buy === undefined ? l.buyPrice : String(buy),
      };
    }));
  };

  const chargeQty = (c: ChargeLine) => (c.qty === '' ? 1 : Number(c.qty) || 0);
  const itemsTotal = lines.reduce((s, l) => s + num(l.qty) * num(l.sellPrice), 0);
  const chargesTotal = charges.reduce((s, c) => s + chargeQty(c) * num(c.price), 0);
  const sellTotal = itemsTotal + chargesTotal + num(nawlon);
  const buyTotal = lines.reduce((s, l) => s + num(l.qty) * num(l.buyPrice), 0);
  const buyTotalEgp = supplierIsUSD ? (rate > 0 ? buyTotal * rate : null) : buyTotal;

  const isDirty = isEdit || !!(clientId || supplierId || lines.some((l) => !!(l.productId || l.qty || l.buyPrice || l.sellPrice)) || charges.some((c) => !!(c.chargeTypeId && c.price)));
  useNavigationGuard(isDirty);
  const handleClose = () => {
    if (isDirty && !window.confirm('توجد بيانات لم تُحفظ. هل تريد المغادرة بدون حفظ؟')) return;
    onClose();
  };

  const save = () => {
    setError('');
    const picked = lines.filter((l) => l.productId && num(l.qty) > 0);
    const items = picked.map((l) => ({
      productId: l.productId, qty: num(l.qty), price: num(l.sellPrice), buyPrice: num(l.buyPrice),
      freight: num(l.freight),
      ...(num(l.freight) > 0 && l.freightTreasuryId ? { freightTreasuryId: l.freightTreasuryId } : {}),
      ...(num(l.freight) > 0 && l.freightNote.trim() ? { freightNote: l.freightNote.trim() } : {}),
      tea: num(l.tea),
      ...(num(l.tea) > 0 && l.teaTreasuryId ? { teaTreasuryId: l.teaTreasuryId } : {}),
      ...(num(l.tea) > 0 && l.teaNote.trim() ? { teaNote: l.teaNote.trim() } : {}),
      commissionQty: num(l.commQty), commissionPrice: num(l.commPrice),
      ...(l.commPartyId && num(l.commQty) > 0 && num(l.commPrice) > 0 ? { commissionPartyId: l.commPartyId } : {}),
    }));
    if (charges.some((c) => !c.chargeTypeId && num(c.price) > 0)) return setError('اختر اسم البند في جدول بنود الشحن');
    const chargesDto = charges
      .filter((c) => c.chargeTypeId && chargeQty(c) * num(c.price) !== 0)
      .map((c) => ({
        chargeTypeId: c.chargeTypeId, qty: chargeQty(c), price: num(c.price),
        ...(c.note.trim() ? { note: c.note.trim() } : {}),
        ...(c.manifestId ? { manifestId: c.manifestId } : {}),
      }));
    if (!clientId) return setError('اختر العميل');
    if (!supplierId) return setError('اختر المورد');
    if (items.length === 0 && chargesDto.length === 0) return setError('أضف صنفاً أو بند شحن واحداً على الأقل');
    if ((num(paidIn) > 0 || num(paidOut) > 0) && !treasuryId) return setError('حددت مبلغاً محصلاً أو مدفوعاً. اختر الخزنة التي يخرج منها المبلغ أو يدخل إليها');
    if (supplierIsUSD && items.length > 0 && !(rate > 0)) return setError('المورد بالدولار. اكتب سعر صرف الدولار اليوم');

    const dto = {
      date, no: no.trim() || undefined, clientId, supplierId, items, charges: chargesDto,
      paidIn: num(paidIn) || undefined, paidOut: num(paidOut) || undefined,
      treasuryId: treasuryId || undefined, note: note.trim() || undefined,
      ...(supplierIsUSD && rate > 0 ? { exchangeRate: rate } : {}),
      // الناولون القديم يُرسل كما هو حتى لا يضيع عند تعديل عملية قديمة
      ...(isEdit ? { nawlon: num(nawlon) } : {}),
    };

    if (isEdit) {
      updateDeal.mutate(
        { id: initialDeal!.id, dto },
        { onSuccess: () => onClose(), onError: (e: any) => setError(e.message) },
      );
    } else {
      createDeal.mutate(dto, {
        onSuccess: (deal) => setSaved({
          dealId: deal.id,
          clientName: clients?.data.find((c) => c.id === clientId)?.name ?? '',
          items: picked
            .filter((l) => !products?.data.find((p) => p.id === l.productId)?.service)
            .map((l) => ({ name: products?.data.find((p) => p.id === l.productId)?.name ?? '', qty: num(l.qty) })),
        }),
        onError: (e: any) => setError(e.message),
      });
    }
  };

  if (saved && makeManifest) {
    return (
      <ManifestEditor
        onClose={onClose}
        onCreated={onClose}
        initial={{ dealId: saved.dealId, clientName: saved.clientName, items: saved.items }}
      />
    );
  }
  if (saved) {
    return (
      <>
        <PageTitle title={`تم حفظ عملية البيع الخارجي رقم ${no} ✅`} />
        <div className="card" style={{ padding: 22 }}>
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>هل تريد عمل كشف عربية لهذه العملية؟</p>
          <p className="muted" style={{ marginTop: -6 }}>سيتم نقل اسم العميل والأصناف تلقائياً، وتكمل بيانات السائق والعربية.</p>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button className="btn btn-primary" onClick={() => setMakeManifest(true)}>نعم، عمل كشف عربية</button>
            <button className="btn btn-ghost" onClick={onClose}>لا، تم</button>
          </div>
        </div>
      </>
    );
  }

  const isPending = isEdit ? updateDeal.isPending : createDeal.isPending;
  const inputStyle = { padding: '7px 9px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 } as const;

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={handleClose}>→ رجوع للبيع الخارجي</button>
      </div>
      <PageTitle
        title={isEdit ? `تعديل عملية بيع خارجي رقم ${initialDeal!.no}` : 'عملية بيع خارجي جديدة'}
        subtitle="شراء من المورد وبيع للعميل في نفس الوقت، بدون أثر على المخزن"
      />
      <div className="card" onKeyDown={fieldNavKeyDown}>
        <div className="form-grid">
          {!isEdit && (
            <Field label="رقم العملية">
              <input value={no} readOnly placeholder="" title="رقم تلقائي يظهر بعد اختيار العميل"
                style={{ fontWeight: 700, textAlign: 'center', width: `${Math.max((no?.length || 0) + 2, 4)}ch` }} />
              {!clientId && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>تلقائي بعد اختيار العميل</div>}
            </Field>
          )}
          <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 'fit-content', maxWidth: '100%' }} /></Field>
          <Field label="العميل (البيع)">
            <PartyCombobox parties={clients?.data ?? []} value={clientId} onChange={setClientId} role="CLIENT" />
            {selClient && (
              <div style={{ fontSize: 12.5, marginTop: 4, fontWeight: 700 }}>
                رصيده الحالي: <span className={(selClient.balance ?? 0) >= 0 ? 'deb' : 'cre'}>{EGP(Math.abs(selClient.balance ?? 0))} {(selClient.balance ?? 0) >= 0 ? 'عليه' : 'له'}</span>
              </div>
            )}
          </Field>
          <Field label="المورد (الشراء)">
            <PartyCombobox parties={suppliers?.data ?? []} value={supplierId} onChange={setSupplierId} role="SUPPLIER" />
            {selSupplier && (
              <div style={{ fontSize: 12.5, marginTop: 4, fontWeight: 700 }}>
                رصيده الحالي: <span className={(selSupplier.balance ?? 0) >= 0 ? 'deb' : 'cre'}>{money(Math.abs(selSupplier.balance ?? 0), supplierIsUSD ? 'USD' : 'EGP')} {(selSupplier.balance ?? 0) >= 0 ? 'عليه' : 'له'}</span>
              </div>
            )}
          </Field>
          <Field label="البيان (اختياري)" full><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>

        {supplierIsUSD && (
          <>
            <div style={{ padding: '6px 16px', background: 'var(--debit-bg)', borderRadius: 8, margin: '0 16px 8px', fontWeight: 700, fontSize: 13, color: 'var(--debit)' }}>
              $ مورد بالدولار: سعر الشراء بالدولار، وسعر البيع بالجنيه
            </div>
            <div className="form-grid">
              <Field label="سعر صرف الدولار اليوم (ج.م لكل $)">
                <MoneyInput value={exchangeRate} onChange={setExchangeRate} placeholder="مثلاً 50" />
              </Field>
              {rate > 0 && (
                <Field label="إجمالي الشراء بالجنيه">
                  <div className="num" style={{ fontWeight: 800, padding: '10px 0' }}>{money(buyTotal, 'USD')} = {EGP(buyTotal * rate)} ج.م</div>
                </Field>
              )}
            </div>
          </>
        )}

        <div className="tbl-wrap combo-table invoice-items">
          <table>
            <thead><tr>
              <th>الكمية</th>
              <th>الصنف</th>
              <th>سعر الشراء {supplierIsUSD ? '($)' : '(ج.م)'}</th>
              <th>سعر البيع (ج.م)</th>
              <th>الإجمالي</th>
              <th></th>
            </tr></thead>
            <tbody>
              {lines.map((l, i) => {
                const prod = l.productId ? products?.data.find((p) => p.id === l.productId) : undefined;
                const ls = prod ? lastSaleBy.get(l.productId) : undefined;
                const lb = prod && !supplierIsUSD ? lastBuyBy.get(l.productId) : undefined;
                const extras = num(l.freight) + num(l.tea) + num(l.commQty) * num(l.commPrice);
                return (
                  <tr key={l._key}>
                    <td><MoneyInput value={l.qty} onChange={(v) => setLine(i, { qty: v })} placeholder="0" style={{ width: 80 }} /></td>
                    <td style={{ minWidth: 300 }}>
                      <ProductCombobox products={products?.data ?? []} value={l.productId} onChange={(id) => pickProduct(i, id)} />
                      {(l.showFreight || l.showTea || l.showComm) && (
                        <div style={{ marginTop: 6, display: 'grid', gap: 4, padding: 6, background: 'var(--line-soft)', borderRadius: 8, fontSize: 12 }}>
                          {l.showFreight && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ minWidth: 42, fontWeight: 700 }}>ناولون</span>
                              <MoneyInput value={l.freight} onChange={(v) => setLine(i, { freight: v })} placeholder="مبلغ" style={{ width: 78 }} />
                              <span className="muted" style={{ fontSize: 11 }}>من خزنة</span>
                              <div style={{ width: 104 }}><Combobox options={treasury?.data ?? []} value={l.freightTreasuryId} onChange={(id) => setLine(i, { freightTreasuryId: id })} placeholder="اختر الخزنة" /></div>
                              <input value={l.freightNote} onChange={(e) => setLine(i, { freightNote: e.target.value })} placeholder="بيان" style={{ ...inputStyle, width: 120 }} />
                              <button className="btn btn-ghost btn-sm" style={{ marginInlineStart: 'auto', color: 'var(--debit)' }} onClick={() => setLine(i, { showFreight: false, freight: '', freightTreasuryId: '', freightNote: '' })}>×</button>
                            </div>
                          )}
                          {l.showTea && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ minWidth: 42, fontWeight: 700 }}>شاي</span>
                              <MoneyInput value={l.tea} onChange={(v) => setLine(i, { tea: v })} placeholder="مبلغ" style={{ width: 78 }} />
                              <span className="muted" style={{ fontSize: 11 }}>من خزنة</span>
                              <div style={{ width: 104 }}><Combobox options={treasury?.data ?? []} value={l.teaTreasuryId} onChange={(id) => setLine(i, { teaTreasuryId: id })} placeholder="اختر الخزنة" /></div>
                              <input value={l.teaNote} onChange={(e) => setLine(i, { teaNote: e.target.value })} placeholder="بيان" style={{ ...inputStyle, width: 120 }} />
                              <button className="btn btn-ghost btn-sm" style={{ marginInlineStart: 'auto', color: 'var(--debit)' }} onClick={() => setLine(i, { showTea: false, tea: '', teaTreasuryId: '', teaNote: '' })}>×</button>
                            </div>
                          )}
                          {l.showComm && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ minWidth: 42, fontWeight: 700 }}>عمولة</span>
                              <MoneyInput value={l.commQty} onChange={(v) => setLine(i, { commQty: v })} placeholder="عدد" style={{ width: 60 }} />
                              <span className="muted">×</span>
                              <MoneyInput value={l.commPrice} onChange={(v) => setLine(i, { commPrice: v })} placeholder="سعر" style={{ width: 70 }} />
                              <span className="num" style={{ fontWeight: 700 }}>= {EGP(num(l.commQty) * num(l.commPrice))}</span>
                              <div style={{ minWidth: 150, flex: 1 }}><CommissionPicker value={l.commPartyId} onChange={(id) => setLine(i, { commPartyId: id })} /></div>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--debit)' }} onClick={() => setLine(i, { showComm: false, commQty: '', commPrice: '', commPartyId: '' })}>×</button>
                            </div>
                          )}
                          {extras > 0 && num(l.qty) > 0 && !supplierIsUSD && (
                            <div className="muted" style={{ fontSize: 11.5 }}>صافي سعر الوحدة عليك: <b>{EGP(num(l.buyPrice) + extras / num(l.qty))}</b></div>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <MoneyInput value={l.buyPrice} placeholder="0" onChange={(v) => setLine(i, { buyPrice: v })} style={{ width: 100 }} />
                      {lb && (
                        <div className="muted" style={{ fontSize: 12, marginTop: 3, cursor: 'pointer' }} title="اضغط لاستخدام آخر سعر شراء" onClick={() => setLine(i, { buyPrice: String(lb.price) })}>
                          آخر شراء: {EGP(lb.price)}
                        </div>
                      )}
                    </td>
                    <td>
                      <MoneyInput value={l.sellPrice} placeholder="0" onChange={(v) => setLine(i, { sellPrice: v })} style={{ width: 100 }} />
                      {ls && (
                        <div className="muted" style={{ fontSize: 12, marginTop: 3, cursor: 'pointer' }} title="اضغط لاستخدام آخر سعر بيع" onClick={() => setLine(i, { sellPrice: String(ls.price) })}>
                          آخر سعر: {EGP(ls.price)}
                        </div>
                      )}
                    </td>
                    <td className="num">{EGP(num(l.qty) * num(l.sellPrice))}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'relative' }}>
                        <button className="btn btn-ghost btn-sm" title="إضافة ناولون أو شاي أو عمولة على الصنف" style={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }} onClick={() => setMenuFor((k) => (k === l._key ? null : l._key))}>⋮</button>
                        {menuFor === l._key && (
                          <div style={{ position: 'absolute', top: '100%', insetInlineEnd: 0, zIndex: 20, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.12)', padding: 4, display: 'grid', gap: 2, minWidth: 130 }}>
                            <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => { setLine(i, { showFreight: true }); setMenuFor(null); }}>➕ ناولون</button>
                            <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => { setLine(i, { showTea: true }); setMenuFor(null); }}>➕ شاي</button>
                            <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => { setLine(i, { showComm: true }); setMenuFor(null); }}>➕ عمولة</button>
                          </div>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => setLines((xs) => xs.filter((_, idx) => idx !== i))}>×</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setLines((ls) => [...ls, blank()])}>+ إضافة صنف</button>
          <span className="num" style={{ marginInlineStart: 'auto', fontWeight: 700 }}>إجمالي الأصناف: {EGP(itemsTotal)}</span>
        </div>

        {/* بنود الشحن — نفس جدول فاتورة البيع: على العميل، نشاطها شحن، ولا تؤثر على المخزون. */}
        <div style={{ margin: '4px 16px 14px', padding: 10, borderRadius: 10, background: 'var(--line-soft)', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <b style={{ fontSize: 13 }}>🚛 بنود الشحن</b>
            <span className="muted" style={{ fontSize: 11.5 }}>لا تؤثر على المخزون</span>
            <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(chargeTypes ?? []).map((ct) => (
                <button key={ct.id} type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                  onClick={() => setCharges((cs) => [...cs, blankCharge(ct.id)])}>+ {ct.name}</button>
              ))}
            </span>
          </div>
          {charges.length > 0 ? (
            <div className="tbl-wrap">
              <table>
                <thead><tr>
                  <th>البند</th><th>الكمية</th><th>السعر (ج.م)</th><th>الإجمالي</th><th>البيان</th><th></th>
                </tr></thead>
                <tbody>
                  {charges.map((c, i) => (
                    <tr key={c._key}>
                      <td style={{ minWidth: 130 }}>
                        <select value={c.chargeTypeId} onChange={(e) => setCharge(i, { chargeTypeId: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                          <option value="">اختر البند</option>
                          {(chargeTypes ?? []).map((ct) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                          {/* بند مؤرشف على عملية قديمة يبقى ظاهراً باسمه */}
                          {c.chargeTypeId && !(chargeTypes ?? []).some((ct) => ct.id === c.chargeTypeId) && (
                            <option value={c.chargeTypeId}>{initialDeal?.charges?.find((x) => x.chargeType?.id === c.chargeTypeId)?.chargeType?.name ?? 'بند مؤرشف'}</option>
                          )}
                        </select>
                      </td>
                      <td><MoneyInput value={c.qty} onChange={(v) => setCharge(i, { qty: v })} placeholder="1" style={{ width: 70 }} /></td>
                      <td><MoneyInput value={c.price} onChange={(v) => setCharge(i, { price: v })} placeholder="0" style={{ width: 100 }} /></td>
                      <td className="num" style={{ fontWeight: 700 }}>{EGP(chargeQty(c) * num(c.price))}</td>
                      <td><input value={c.note} onChange={(e) => setCharge(i, { note: e.target.value })} placeholder="اختياري" style={{ ...inputStyle, width: 140 }} /></td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => setCharges((cs) => cs.filter((_, idx) => idx !== i))}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12 }}>لا توجد بنود شحن على هذه العملية</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => setCharges((cs) => [...cs, blankCharge()])}>+ بند شحن</button>
            <span className="num" style={{ marginInlineStart: 'auto', fontWeight: 700 }}>إجمالي بنود الشحن: {EGP(chargesTotal)}</span>
          </div>
        </div>

        <div className="form-grid" style={{ borderTop: '1px solid var(--line-soft)' }}>
          <Field label="المحصل من العميل الآن"><MoneyInput value={paidIn} onChange={setPaidIn} placeholder="0.00" /></Field>
          <Field label={supplierIsUSD ? 'المدفوع للمورد الآن ($)' : 'المدفوع للمورد الآن'}><MoneyInput value={paidOut} onChange={setPaidOut} placeholder="0.00" /></Field>
          <Field label="حساب الخزنة"><Combobox options={treasury?.data ?? []} value={treasuryId} onChange={setTreasuryId} /></Field>
          {isEdit && !!initialDeal?.nawlon && (
            <Field label="ناولون العملية (مسجل سابقاً)">
              <MoneyInput value={nawlon} onChange={setNawlon} placeholder="0.00" />
              <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>يمكن نقله إلى جدول بنود الشحن وتصفير هذا الحقل</div>
            </Field>
          )}
        </div>

        <div className="num" style={{ padding: '0 16px', fontSize: 13, color: 'var(--ink-soft)' }}>
          الأصناف: {EGP(itemsTotal)} · بنود الشحن: {EGP(chargesTotal)}{num(nawlon) > 0 && <> · ناولون: {EGP(num(nawlon))}</>}
        </div>
        <div className="page-title num" style={{ padding: '0 16px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <span>الإجمالي على العميل: {EGP(sellTotal)}</span>
          <span style={{ color: 'var(--debit)', fontSize: 14 }}>إجمالي الشراء: {money(buyTotal, supplierIsUSD ? 'USD' : 'EGP')}</span>
          {buyTotalEgp !== null && itemsTotal > 0 && (
            <span style={{ fontSize: 14 }}>ربح الأصناف: <span className={itemsTotal - buyTotalEgp >= 0 ? 'cre' : 'deb'}>{EGP(itemsTotal - buyTotalEgp)}</span></span>
          )}
        </div>
        <div className="err-text" style={{ padding: '0 16px' }}>{error}</div>
        <div className="toolbar" style={{ padding: 16 }}>
          <button className="btn btn-primary" onClick={save} disabled={isPending}>
            {isPending ? '...' : isEdit ? 'حفظ التعديلات' : 'حفظ العملية'}
          </button>
          <button className="btn btn-ghost" onClick={handleClose}>إلغاء</button>
        </div>
      </div>
    </>
  );
}
