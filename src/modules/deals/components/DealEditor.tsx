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
import { useAuth } from '@/lib/auth';
import { useCreateDeal, useUpdateDeal } from '../hooks';
import { useUpdateProduct } from '../../products/hooks';
import { dealsApi } from '../api';
import type { Deal } from '../dtos';

interface Line { productId: string; qty: string; buyPrice: string; sellPrice: string; }
const blank = (): Line => ({ productId: '', qty: '', buyPrice: '', sellPrice: '' });
const num = (s: string) => Number(s) || 0;

export function DealEditor({ onClose, initialDeal }: { onClose: () => void; initialDeal?: Deal }) {
  const isEdit = !!initialDeal;
  const { can } = useAuth();
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
  const [commissionAmount, setCommissionAmount] = useState('');
  const [commissionPartyId, setCommissionPartyId] = useState('');
  const [nawlon, setNawlon] = useState(() => initialDeal?.nawlon ? String(initialDeal.nawlon) : '');
  const [lines, setLines] = useState<Line[]>(() =>
    initialDeal?.items.length
      ? initialDeal.items.map((it) => ({
          productId: it.product?.id ?? '',
          qty: String(it.qty),
          buyPrice: String(it.buyPrice ?? 0),
          sellPrice: String(it.price),
        }))
      : [blank()]
  );
  const [prefilled, setPrefilled] = useState(!!initialDeal);

  // prefill service lines for new deals
  useEffect(() => {
    if (prefilled || !products) return;
    const svc = products.data.filter((p) => p.service);
    if (svc.length) setLines([...svc.map((p) => ({ productId: p.id, qty: '', buyPrice: '', sellPrice: '' })), blank()]);
    setPrefilled(true);
  }, [products, prefilled]);

  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ clientName: string; items: { name: string; qty: number }[] } | null>(null);
  const [makeManifest, setMakeManifest] = useState(false);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const supplierIsUSD = suppliers?.data.find((s) => s.id === supplierId)?.currency === 'USD';

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
    const items = picked.map((l) => ({ productId: l.productId, qty: num(l.qty), price: num(l.sellPrice), buyPrice: num(l.buyPrice) }));
    if (!clientId) return setError('اختر العميل');
    if (!supplierId) return setError('اختر المورد');
    if (items.length === 0) return setError('أضف صنفًا واحدًا على الأقل');

    const dto = {
      date, no: no.trim() || undefined, clientId, supplierId, items,
      paidIn: num(paidIn) || undefined, paidOut: num(paidOut) || undefined,
      nawlon: num(nawlon) || undefined,
      treasuryId: treasuryId || undefined, note: note.trim() || undefined,
      ...(num(commissionAmount) > 0 && commissionPartyId ? { commissionAmount: num(commissionAmount), commissionPartyId } : {}),
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
          <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="رقم العملية"><input value={no} onChange={(e) => setNo(e.target.value)} placeholder={isEdit ? '' : clientId ? '…' : 'اختر العميل أولاً'} style={no ? { fontWeight: 700 } : {}} /></Field>
          <Field label="المورد (الشراء)"><PartyCombobox parties={suppliers?.data ?? []} value={supplierId} onChange={setSupplierId} role="SUPPLIER" /></Field>
          <Field label="العميل (البيع)"><PartyCombobox parties={clients?.data ?? []} value={clientId} onChange={setClientId} role="CLIENT" /></Field>
          <Field label="البيان (اختياري)" full><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>

        {supplierIsUSD && (
          <div style={{ padding: '6px 16px', background: 'var(--debit-bg)', borderRadius: 8, margin: '0 16px 8px', fontWeight: 700, fontSize: 13, color: 'var(--debit)' }}>
            $ مورد دولاري — سعر الشراء بالدولار، سعر البيع بالجنيه
          </div>
        )}
        <div className="tbl-wrap combo-table">
          <table>
            <thead>
              <tr>
                <th>الصنف</th><th>الكمية</th>
                <th>سعر الشراء {supplierIsUSD ? '($)' : '(ج.م)'}</th>
                <th>سعر البيع (ج.م)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const prod = l.productId ? products?.data.find((p) => p.id === l.productId) : undefined;
                return (
                  <tr key={i}>
                    <td style={{ minWidth: 240 }}>
                      <ProductCombobox products={products?.data ?? []} value={l.productId} onChange={(id) => setLine(i, { productId: id })} />
                    </td>
                    <td><MoneyInput value={l.qty} onChange={(v) => setLine(i, { qty: v })} placeholder="0" style={{ width: 70 }} /></td>
                    <td><MoneyInput value={l.buyPrice} placeholder="0" onChange={(v) => setLine(i, { buyPrice: v })} style={{ width: 100 }} /></td>
                    <td><MoneyInput value={l.sellPrice} placeholder="0" onChange={(v) => setLine(i, { sellPrice: v })} style={{ width: 100 }} /></td>
                    <td style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {prod && (
                        <button
                          title={prod.service ? 'إلغاء التثبيت كبند افتراضي' : 'تثبيت — يظهر تلقائياً في كل فاتورة جديدة'}
                          className="btn btn-ghost btn-sm"
                          style={{ opacity: prod.service ? 1 : 0.35, fontSize: 15 }}
                          onClick={() => updateProduct.mutate({ id: prod.id, dto: { service: !prod.service } })}
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
          <button className="btn btn-ghost btn-sm" onClick={() => setLines((ls) => [...ls, blank()])}>+ إضافة صنف</button>
        </div>

        <div className="form-grid" style={{ borderTop: '1px solid var(--line-soft)' }}>
          <Field label="ناولون (رسوم مناولة/شحن — تُضاف على العميل)">
            <MoneyInput value={nawlon} onChange={setNawlon} placeholder="0.00" />
          </Field>
        </div>

        <div className="form-grid" style={{ borderTop: '1px solid var(--line-soft)' }}>
          <Field label="محصّل من العميل الآن"><MoneyInput value={paidIn} onChange={setPaidIn} placeholder="0.00" /></Field>
          <Field label={supplierIsUSD ? 'مدفوع للمورد ($)' : 'مدفوع للمورد الآن'}><MoneyInput value={paidOut} onChange={setPaidOut} placeholder="0.00" /></Field>
          <Field label="حساب الخزنة"><Combobox options={treasury?.data ?? []} value={treasuryId} onChange={setTreasuryId} /></Field>
        </div>

        {can('invoices.commission') && (
          <div className="form-grid" style={{ borderTop: '1px solid var(--line-soft)' }}>
            <Field label="مبلغ commission"><MoneyInput value={commissionAmount} onChange={setCommissionAmount} placeholder="0.00" /></Field>
            <Field label="commission لصالح (تُضاف لرصيده)"><CommissionPicker value={commissionPartyId} onChange={setCommissionPartyId} /></Field>
          </div>
        )}

        <div className="page-title num" style={{ padding: '0 16px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <span>إجمالي البيع: {EGP(sellTotal)}</span>
          {num(nawlon) > 0 && <span style={{ color: 'var(--debit)', fontSize: 14 }}>ناولون: {EGP(num(nawlon))}</span>}
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
