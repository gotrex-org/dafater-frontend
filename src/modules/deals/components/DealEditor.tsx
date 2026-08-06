'use client';

import { useEffect, useState } from 'react';
import { money, EGP, todayISO } from '@/lib/format';
import { useNavigationGuard } from '@/lib/useNavigationGuard';
import { fieldNavKeyDown } from '@/lib/field-nav';
import { PageTitle, Field, Combobox, MoneyInput } from '@/components/common';
import { useAllParties } from '../../parties/hooks';
import { useAllProducts } from '../../products/hooks';
import { useAllTreasury } from '../../treasury/hooks';
import { ProductCombobox } from '../../products/components/ProductCombobox';
import { CommissionPicker } from '../../invoices/components/CommissionPicker';
import { PartyCombobox } from '../../invoices/components/PartyCombobox';
import { ManifestEditor } from '../../manifests/components/ManifestEditor';
import { useCreateDeal, useUpdateDeal } from '../hooks';
import { useUpdateProduct } from '../../products/hooks';
import { dealsApi } from '../api';
import type { Deal } from '../dtos';

interface Line {
  _key: number; productId: string; qty: string; buyPrice: string; sellPrice: string;
  freight: string; freightTreasuryId: string; freightNote: string; // ناولون خارجي
  tea: string; teaTreasuryId: string; teaNote: string;             // شاي
  commQty: string; commPrice: string; commPartyId: string;         // عمولة = عدد × سعر لمين
  showFreight?: boolean; showTea?: boolean; showComm?: boolean;
  bnd?: boolean; // بند إضافي (خدمة/رسوم) — قسم منفصل تحت الأصناف زي الفواتير
}
let _dk = 0;
const blank = (): Line => ({ _key: _dk++, productId: '', qty: '', buyPrice: '', sellPrice: '', freight: '', freightTreasuryId: '', freightNote: '', tea: '', teaTreasuryId: '', teaNote: '', commQty: '', commPrice: '', commPartyId: '' });
const bndBlank = (): Line => ({ ...blank(), bnd: true });
const num = (s: string) => Number(s) || 0;

export function DealEditor({ onClose, initialDeal }: { onClose: () => void; initialDeal?: Deal }) {
  const isEdit = !!initialDeal;
  const { data: clients } = useAllParties('CLIENT');
  const { data: suppliers } = useAllParties('SUPPLIER');
  const { data: products } = useAllProducts();
  const { data: treasury } = useAllTreasury();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const updateProduct = useUpdateProduct();

  const [date, setDate] = useState(() => initialDeal ? initialDeal.date.split('T')[0] : todayISO());
  const [no, setNo] = useState(() => initialDeal?.no ?? '');
  const [clientId, setClientId] = useState(() => initialDeal?.client?.id ?? '');
  const [supplierId, setSupplierId] = useState(() => initialDeal?.supplier?.id ?? '');
  const [treasuryId, setTreasuryId] = useState(() => initialDeal?.treasury?.id ?? '');
  const [paidIn, setPaidIn] = useState(() => initialDeal?.paidIn ? String(initialDeal.paidIn) : '');
  const [paidOut, setPaidOut] = useState(() => initialDeal?.paidOut ? String(initialDeal.paidOut) : '');
  const [note, setNote] = useState(() => initialDeal?.note ?? '');

  // Auto-fill deal number when client is selected (create mode only)
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
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [prefilled, setPrefilled] = useState(!!initialDeal);
  // في التعديل، لما الأصناف تحمّل نصنّف الخدمات كبنود إضافية (تحت الأصناف) زي الفواتير.
  const [classified, setClassified] = useState(!isEdit);

  // prefill service items as بنود إضافية for new deals (a blank product line first)
  useEffect(() => {
    if (prefilled || !products) return;
    const svc = products.data.filter((p) => p.service);
    if (svc.length) setLines([blank(), ...svc.map((p) => ({ ...bndBlank(), productId: p.id }))]);
    setPrefilled(true);
  }, [products, prefilled]);

  // on edit: reclassify existing service lines into the بنود block once products are known
  useEffect(() => {
    if (classified || !products) return;
    const svcIds = new Set(products.data.filter((p) => p.service).map((p) => p.id));
    setLines((ls) => ls.map((l) => (svcIds.has(l.productId) ? { ...l, bnd: true } : l)));
    setClassified(true);
  }, [products, classified]);

  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ clientName: string; items: { name: string; qty: number }[] } | null>(null);
  const [makeManifest, setMakeManifest] = useState(false);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const selSupplier = suppliers?.data.find((s) => s.id === supplierId);
  const selClient = clients?.data.find((c) => c.id === clientId);
  const supplierIsUSD = selSupplier?.currency === 'USD';

  const sellTotal = lines.reduce((s, l) => s + num(l.qty) * num(l.sellPrice), 0);
  const buyTotal  = lines.reduce((s, l) => s + num(l.qty) * num(l.buyPrice), 0);

  const isDirty = isEdit || !!(clientId || supplierId || lines.some((l) => !!(l.productId || l.qty || l.buyPrice || l.sellPrice)));
  useNavigationGuard(isDirty);
  const handleClose = () => {
    if (isDirty && !window.confirm('في بيانات لم تُحفظ — هل تريد المغادرة بدون حفظ؟')) return;
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
    if (!clientId) return setError('اختر العميل');
    if (!supplierId) return setError('اختر المورد');
    if (items.length === 0) return setError('أضف صنفًا واحدًا على الأقل');
    if ((num(paidIn) > 0 || num(paidOut) > 0) && !treasuryId) return setError('اخترت مبلغ محصّل/مدفوع — لازم تختار الخزنة اللي المبلغ خارج/داخل منها');

    const dto = {
      date, no: no.trim() || undefined, clientId, supplierId, items,
      paidIn: num(paidIn) || undefined, paidOut: num(paidOut) || undefined,
      treasuryId: treasuryId || undefined, note: note.trim() || undefined,
    };

    if (isEdit) {
      updateDeal.mutate(
        { id: initialDeal!.id, dto },
        { onSuccess: () => onClose(), onError: (e: any) => setError(e.message) },
      );
    } else {
      createDeal.mutate(dto, {
        onSuccess: () => setSaved({
          clientName: clients?.data.find((c) => c.id === clientId)?.name ?? '',
          items: picked
            .filter((l) => !products?.data.find((p) => p.id === l.productId)?.service)
            .map((l) => ({ name: products?.data.find((p) => p.id === l.productId)?.name ?? '', qty: num(l.qty) })),
        }),
        onError: (e: any) => setError(e.message),
      });
    }
  };

  if (saved && makeManifest) return <ManifestEditor onClose={onClose} onCreated={onClose} initial={saved} />;
  if (saved) {
    return (
      <>
        <PageTitle title="تم حفظ العملية ✅" />
        <div className="card" style={{ padding: 22 }}>
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>هل تريد عمل كشف عربية لهذه العملية؟</p>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button className="btn btn-primary" onClick={() => setMakeManifest(true)}>نعم، اعمل كشف عربية</button>
            <button className="btn btn-ghost" onClick={onClose}>لا، تم</button>
          </div>
        </div>
      </>
    );
  }

  const isPending = isEdit ? updateDeal.isPending : createDeal.isPending;

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={handleClose}>→ رجوع للبيع الخارجي</button>
      <PageTitle
        title={isEdit ? `تعديل عملية #${initialDeal!.no}` : 'عملية بيع خارجي جديدة'}
        subtitle="شراء من المورد وبيع للعميل في نفس الوقت — الفرق ربح"
      />
      <div className="card" onKeyDown={fieldNavKeyDown}>
        <div className="form-grid">
          {!isEdit && (
            <Field label="رقم العملية">
              <input value={no} readOnly placeholder="" title="رقم تلقائي — يظهر بعد اختيار العميل"
                style={{ fontWeight: 700, textAlign: 'center', width: `${Math.max((no?.length || 0) + 2, 4)}ch` }} />
              {!clientId && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>تلقائي بعد اختيار العميل</div>}
            </Field>
          )}
          <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 'fit-content', maxWidth: '100%' }} /></Field>
          <Field label="المورد (الشراء)">
            <PartyCombobox parties={suppliers?.data ?? []} value={supplierId} onChange={setSupplierId} role="SUPPLIER" />
            {selSupplier && <div style={{ fontSize: 12.5, marginTop: 4, fontWeight: 700 }}>رصيده: <span className={(selSupplier.balance ?? 0) >= 0 ? 'deb' : 'cre'}>{EGP(Math.abs(selSupplier.balance ?? 0))} {(selSupplier.balance ?? 0) >= 0 ? 'عليه' : 'له'}</span></div>}
          </Field>
          <Field label="العميل (البيع)">
            <PartyCombobox parties={clients?.data ?? []} value={clientId} onChange={setClientId} role="CLIENT" />
            {selClient && <div style={{ fontSize: 12.5, marginTop: 4, fontWeight: 700 }}>رصيده: <span className={(selClient.balance ?? 0) >= 0 ? 'deb' : 'cre'}>{EGP(Math.abs(selClient.balance ?? 0))} {(selClient.balance ?? 0) >= 0 ? 'عليه' : 'له'}</span></div>}
          </Field>
          <Field label="البيان (اختياري)" full><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>

        {supplierIsUSD && (
          <div style={{ padding: '6px 16px', background: 'var(--debit-bg)', borderRadius: 8, margin: '0 16px 8px', fontWeight: 700, fontSize: 13, color: 'var(--debit)' }}>
            $ مورد دولاري — سعر الشراء بالدولار، سعر البيع بالجنيه
          </div>
        )}
        <div className="tbl-wrap combo-table invoice-items">
          <table>
            <thead>
              <tr>
                <th>الكمية</th><th>الصنف</th>
                <th>سعر الشراء {supplierIsUSD ? '($)' : '(ج.م)'}</th>
                <th>سعر البيع (ج.م)</th>
                <th>الإجمالي</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                if (l.bnd) return null; // البنود الإضافية ليها قسم منفصل تحت
                const prod = l.productId ? products?.data.find((p) => p.id === l.productId) : undefined;
                return (
                  <tr key={l._key}>
                    <td><MoneyInput value={l.qty} onChange={(v) => setLine(i, { qty: v })} placeholder="0" style={{ width: 70 }} /></td>
                    <td style={{ minWidth: 240 }}>
                      <ProductCombobox products={products?.data ?? []} value={l.productId} onChange={(id) => setLine(i, { productId: id })} />
                      {(l.showFreight || l.showTea || l.showComm) && (
                        <div style={{ marginTop: 6, display: 'grid', gap: 4, padding: 6, background: 'var(--line-soft)', borderRadius: 8, fontSize: 12 }}>
                          {l.showFreight && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ minWidth: 70, fontWeight: 700 }}>ناولون خارجي</span>
                              <MoneyInput value={l.freight} onChange={(v) => setLine(i, { freight: v })} placeholder="مبلغ" style={{ width: 78 }} />
                              <span className="muted" style={{ fontSize: 11 }}>من خزنة</span>
                              <div style={{ width: 104 }}><Combobox options={treasury?.data ?? []} value={l.freightTreasuryId} onChange={(id) => setLine(i, { freightTreasuryId: id })} placeholder="اختر" /></div>
                              <input value={l.freightNote} onChange={(e) => setLine(i, { freightNote: e.target.value })} placeholder="بيان (تريلا/جرار...)" style={{ width: 130, padding: '7px 9px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
                              <button className="btn btn-ghost btn-sm" style={{ marginInlineStart: 'auto', color: 'var(--debit)' }} onClick={() => setLine(i, { showFreight: false, freight: '', freightTreasuryId: '', freightNote: '' })}>×</button>
                            </div>
                          )}
                          {l.showTea && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ minWidth: 70, fontWeight: 700 }}>شاي</span>
                              <MoneyInput value={l.tea} onChange={(v) => setLine(i, { tea: v })} placeholder="مبلغ" style={{ width: 78 }} />
                              <span className="muted" style={{ fontSize: 11 }}>من خزنة</span>
                              <div style={{ width: 104 }}><Combobox options={treasury?.data ?? []} value={l.teaTreasuryId} onChange={(id) => setLine(i, { teaTreasuryId: id })} placeholder="اختر" /></div>
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
                              <span className="num" style={{ fontWeight: 700 }}>= {money(num(l.commQty) * num(l.commPrice), 'EGP')}</span>
                              <div style={{ minWidth: 150, flex: 1 }}><CommissionPicker value={l.commPartyId} onChange={(id) => setLine(i, { commPartyId: id })} /></div>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--debit)' }} onClick={() => setLine(i, { showComm: false, commQty: '', commPrice: '', commPartyId: '' })}>×</button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td><MoneyInput value={l.buyPrice} placeholder="0" onChange={(v) => setLine(i, { buyPrice: v })} style={{ width: 100 }} /></td>
                    <td><MoneyInput value={l.sellPrice} placeholder="0" onChange={(v) => setLine(i, { sellPrice: v })} style={{ width: 100 }} /></td>
                    <td className="num">{EGP(num(l.qty) * num(l.sellPrice))}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'relative' }}>
                        {prod && (
                          <button
                            title={prod.service ? 'إلغاء التثبيت كبند افتراضي' : 'تثبيت — يظهر تلقائياً في كل عملية جديدة'}
                            className="btn btn-ghost btn-sm"
                            style={{ opacity: prod.service ? 1 : 0.35, fontSize: 15 }}
                            onClick={() => updateProduct.mutate({ id: prod.id, dto: { service: !prod.service } })}
                          >📌</button>
                        )}
                        <button className="btn btn-ghost btn-sm" title="إضافة ناولون خارجي / شاي / عمولة" style={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }} onClick={() => setMenuFor((k) => (k === l._key ? null : l._key))}>⋮</button>
                        {menuFor === l._key && (
                          <div style={{ position: 'absolute', top: '100%', insetInlineEnd: 0, zIndex: 20, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.12)', padding: 4, display: 'grid', gap: 2, minWidth: 140 }}>
                            <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => { setLine(i, { showComm: true }); setMenuFor(null); }}>➕ عمولة</button>
                            <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => { setLine(i, { showFreight: true }); setMenuFor(null); }}>➕ ناولون خارجي</button>
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
            const nl = blank();
            return idx === -1 ? [...ls, nl] : [...ls.slice(0, idx), nl, ...ls.slice(idx)];
          })}>+ إضافة صنف</button>
        </div>

        {/* البنود الإضافية — قسم منفصل عن الأصناف، زي الفواتير العادية (سعر بيع بس) */}
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
                  <MoneyInput value={l.sellPrice} onChange={(v) => setLine(i, { sellPrice: v })} placeholder="سعر" style={{ width: 78 }} />
                  <span className="num" style={{ minWidth: 74, fontWeight: 700, textAlign: 'end', fontSize: 12 }}>{EGP(num(l.qty) * num(l.sellPrice))}</span>
                  <button className="btn btn-danger btn-sm" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>×</button>
                </div>
              );
            })}
            {!lines.some((l) => l.bnd) && <div className="muted" style={{ fontSize: 11.5 }}>لا توجد بنود إضافية</div>}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 6, fontSize: 12 }} onClick={() => setLines((ls) => [...ls, bndBlank()])}>+ بند إضافي</button>
        </div>

        <div className="form-grid" style={{ borderTop: '1px solid var(--line-soft)' }}>
          <Field label="محصّل من العميل الآن"><MoneyInput value={paidIn} onChange={setPaidIn} placeholder="0.00" /></Field>
          <Field label={supplierIsUSD ? 'مدفوع للمورد ($)' : 'مدفوع للمورد الآن'}><MoneyInput value={paidOut} onChange={setPaidOut} placeholder="0.00" /></Field>
          <Field label="حساب الخزنة"><Combobox options={treasury?.data ?? []} value={treasuryId} onChange={setTreasuryId} /></Field>
        </div>

        <div className="page-title num" style={{ padding: '0 16px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <span>إجمالي البيع: {EGP(sellTotal)}</span>
          {supplierIsUSD
            ? <span style={{ color: 'var(--debit)', fontSize: 14 }}>إجمالي الشراء: {money(buyTotal, 'USD')}</span>
            : <span style={{ color: 'var(--debit)', fontSize: 14 }}>إجمالي الشراء: {EGP(buyTotal)}</span>
          }
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
