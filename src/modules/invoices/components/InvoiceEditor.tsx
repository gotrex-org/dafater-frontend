'use client';

import { useEffect, useState } from 'react';
import { money, todayISO } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useNavigationGuard } from '@/lib/useNavigationGuard';
import { fieldNavKeyDown } from '@/lib/field-nav';
import { PageTitle, Field, Combobox, MoneyInput } from '@/components/common';
import { useAllParties } from '../../parties/hooks';
import { useAllProducts, useCreateProduct, useUpdateProduct } from '../../products/hooks';
import { useAllWarehouses } from '../../warehouses/hooks';
import { useAllTreasury } from '../../treasury/hooks';
import { ManifestEditor } from '../../manifests/components/ManifestEditor';
import { useCreateInvoice, useUpdateInvoice } from '../hooks';
import { invoicesApi } from '../api';
import { ProductCombobox } from '../../products/components/ProductCombobox';
import { PartyCombobox } from './PartyCombobox';
import { CommissionPicker } from './CommissionPicker';
import type { Invoice, InvoiceKind } from '../dtos';

interface Line { _key: number; productId: string; qty: string; price: string; }
let _nextKey = 0;
const blankLine = (): Line => ({ _key: _nextKey++, productId: '', qty: '', price: '' });

interface Props {
  kind: InvoiceKind;
  onClose: () => void;
  /** when editing an existing invoice */
  invoice?: Invoice;
  onUpdated?: () => void;
}

export function InvoiceEditor({ kind, onClose, invoice, onUpdated }: Props) {
  const { can } = useAuth();
  const isEdit = !!invoice;
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

  const [no, setNo] = useState(invoice?.no ?? '');
  const [date, setDate] = useState(invoice?.date?.slice(0, 10) ?? todayISO());
  const [partyId, setPartyId] = useState(invoice?.party?.id ?? '');

  // Auto-fill invoice number when party is selected (create mode only)
  useEffect(() => {
    if (!partyId || isEdit) return;
    invoicesApi.nextNo(partyId).then(({ no: n }) => setNo(n)).catch(() => {});
  }, [partyId, isEdit]);
  const [warehouseId, setWarehouseId] = useState(invoice?.warehouse?.id ?? '');
  const [treasuryId, setTreasuryId] = useState('');
  const [paid, setPaid] = useState(invoice ? String(invoice.paid || '') : '');
  const [note, setNote] = useState(invoice?.note ?? '');
  const [commissionAmount, setCommissionAmount] = useState('');
  const [commissionPartyId, setCommissionPartyId] = useState('');
  const [lines, setLines] = useState<Line[]>(
    invoice?.items.length
      ? invoice.items.map((it) => ({ _key: _nextKey++, productId: it.productId, qty: String(it.qty), price: String(it.price) }))
      : [blankLine()],
  );
  const [prefilled, setPrefilled] = useState(isEdit);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Invoice | null>(null);
  const [makeManifest, setMakeManifest] = useState(false);

  // prefill service lines for all new invoices
  useEffect(() => {
    if (prefilled || !products) return;
    const svc = products.data.filter((p) => p.service);
    if (svc.length) setLines([...svc.map((p) => ({ _key: _nextKey++, productId: p.id, qty: '', price: '' })), blankLine()]);
    setPrefilled(true);
  }, [products, prefilled]);

  const isDirty = isEdit || !!partyId || lines.some((l) => !!(l.productId || l.qty || l.price));
  useNavigationGuard(isDirty);
  const handleClose = () => {
    if (isDirty && !window.confirm('في بيانات لم تُحفظ — هل تريد المغادرة بدون حفظ؟')) return;
    onClose();
  };

  const selectedParty = parties?.data.find((p) => p.id === partyId);
  const isUSD = selectedParty?.currency === 'USD';
  const cur = isUSD ? 'USD' : 'EGP';

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
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

    if (isEdit) {
      updateInvoice.mutate(
        {
          id: invoice!.id,
          dto: {
            date, partyId, warehouseId, items,
            paid: Number(paid) || 0,
            treasuryId: treasuryId || undefined,
            note: note || undefined,
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
          kind, no: no.trim() || undefined, date, partyId, warehouseId,
          items, paid: Number(paid) || 0, treasuryId: treasuryId || undefined, note: note || undefined,
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
      <button className="btn btn-ghost btn-sm" onClick={handleClose}>→ رجوع لقائمة الفواتير</button>
      <PageTitle title={isEdit ? `تعديل ${kind === 'SALE' ? 'فاتورة بيع' : 'فاتورة شراء'} رقم ${invoice?.no}` : kind === 'SALE' ? 'فاتورة بيع جديدة' : 'فاتورة شراء جديدة'} />
      <div className="card" onKeyDown={fieldNavKeyDown}>
        <div className="form-grid">
          {!isEdit && <Field label="رقم الفاتورة"><input value={no} onChange={(e) => setNo(e.target.value)} placeholder={partyId ? '…' : 'اختر العميل أولاً'} style={no ? { fontWeight: 700 } : {}} /></Field>}
          <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={kind === 'SALE' ? 'العميل' : 'المورد'}>
            <PartyCombobox parties={parties?.data ?? []} value={partyId} onChange={setPartyId} role={role} />
          </Field>
          <Field label="المخزن">
            <Combobox options={warehouses?.data ?? []} value={warehouseId} onChange={setWarehouseId} />
          </Field>
          <Field label="البيان (اختياري)" full><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>

        {isUSD && (
          <div style={{ padding: '6px 16px', background: 'var(--debit-bg)', borderRadius: 8, margin: '0 16px 8px', fontWeight: 700, fontSize: 13, color: 'var(--debit)' }}>
            $ فاتورة دولارية — جميع الأسعار بالدولار
          </div>
        )}
        <div className="tbl-wrap combo-table invoice-items">
          <table>
            <thead><tr><th>الكمية</th><th>الصنف</th><th>السعر {isUSD ? '($)' : '(ج.م)'}</th><th>الإجمالي</th><th></th></tr></thead>
            <tbody>
              {lines.map((l, i) => {
                const prod = l.productId ? products?.data.find((p) => p.id === l.productId) : undefined;
                return (
                  <tr key={l._key}>
                    <td><MoneyInput value={l.qty} onChange={(v) => setLine(i, { qty: v })} placeholder="0" style={{ width: 80 }} /></td>
                    <td style={{ minWidth: 320 }}>
                      <ProductCombobox
                        products={products?.data ?? []}
                        value={l.productId}
                        onChange={(id) => setLine(i, { productId: id })}
                      />
                    </td>
                    <td><MoneyInput value={l.price} onChange={(v) => setLine(i, { price: v })} placeholder="0" style={{ width: 110 }} /></td>
                    <td className="num">{money(Number(l.qty) * Number(l.price), cur)}</td>
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

        <div className="form-grid">
          <Field label="المدفوع نقدًا الآن"><MoneyInput value={paid} onChange={setPaid} placeholder="0.00" /></Field>
          <Field label="حساب الخزنة">
            <Combobox options={treasury?.data ?? []} value={treasuryId} onChange={setTreasuryId} />
          </Field>
        </div>

        {kind === 'PURCHASE' && can('invoices.commission') && (
          <div className="form-grid" style={{ borderTop: '1px solid var(--line-soft)' }}>
            <Field label="مبلغ commission"><MoneyInput value={commissionAmount} onChange={setCommissionAmount} placeholder="0.00" /></Field>
            <Field label="commission لصالح (تُضاف لرصيده)">
              <CommissionPicker value={commissionPartyId} onChange={setCommissionPartyId} />
            </Field>
          </div>
        )}

        <div className="page-title num" style={{ padding: '0 16px' }}>الإجمالي: {money(total, cur)}</div>
        <div className="err-text" style={{ padding: '0 16px' }}>{error}</div>
        <div className="toolbar" style={{ padding: 16 }}>
          <button className="btn btn-primary" onClick={save} disabled={isPending}>
            {isPending ? '...' : isEdit ? 'حفظ التعديلات' : 'حفظ الفاتورة'}
          </button>
          <button className="btn btn-ghost" onClick={handleClose}>إلغاء</button>
        </div>
      </div>
    </>
  );
}
