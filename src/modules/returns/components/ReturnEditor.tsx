'use client';

import { useState } from 'react';
import { EGP, todayISO } from '@/lib/format';
import { fieldNavKeyDown } from '@/lib/field-nav';
import { PageTitle, Field, Combobox, MoneyInput, SearchInput, SegmentedControl } from '@/components/common';
import { useAllParties } from '../../parties/hooks';
import { useAllProducts } from '../../products/hooks';
import { useAllWarehouses } from '../../warehouses/hooks';
import { useAllTreasury } from '../../treasury/hooks';
import { useInvoices } from '../../invoices/hooks';
import { ProductCombobox } from '../../products/components/ProductCombobox';
import { PartyCombobox } from '../../invoices/components/PartyCombobox';
import { useCreateReturn } from '../hooks';
import type { Invoice, InvoiceKind } from '../../invoices/dtos';
import type { CreateReturnDto } from '../dtos';

interface FreeLine { _k: number; productId: string; qty: string; price: string; }
let _k = 0;
const blank = (): FreeLine => ({ _k: _k++, productId: '', qty: '', price: '' });
const num = (s: string) => Number(s) || 0;

export function ReturnEditor({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'invoice' | 'free'>('invoice');
  const [kind, setKind] = useState<InvoiceKind>('SALE'); // free mode only; invoice mode inherits
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [refund, setRefund] = useState('');
  const [treasuryId, setTreasuryId] = useState('');
  const [error, setError] = useState('');

  const { data: warehouses } = useAllWarehouses();
  const { data: treasury } = useAllTreasury();
  const { data: products } = useAllProducts();
  const createReturn = useCreateReturn();

  // ── invoice mode ──
  const [invSearch, setInvSearch] = useState('');
  const { data: invData } = useInvoices({ search: invSearch || undefined, pageSize: 20 });
  const [picked, setPicked] = useState<Invoice | null>(null);
  const [retQty, setRetQty] = useState<Record<number, string>>({});

  // ── free mode ──
  const role = kind === 'SALE' ? 'CLIENT' : 'SUPPLIER';
  const { data: parties } = useAllParties(role);
  const [partyId, setPartyId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState<FreeLine[]>([blank()]);
  const setLine = (i: number, patch: Partial<FreeLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const effKind: InvoiceKind = mode === 'invoice' ? (picked?.kind ?? 'SALE') : kind;
  const isSale = effKind === 'SALE';

  const invoiceTotal = picked ? picked.items.reduce((s, it, i) => s + num(retQty[i] ?? '') * it.price, 0) : 0;
  const freeTotal = lines.reduce((s, l) => s + num(l.qty) * num(l.price), 0);
  const total = mode === 'invoice' ? invoiceTotal : freeTotal;

  const pickInvoice = (id: string) => {
    setPicked(invData?.data.find((x) => x.id === id) ?? null);
    setRetQty({});
  };

  const save = () => {
    setError('');
    let dto: CreateReturnDto;
    if (mode === 'invoice') {
      if (!picked) return setError('اختر الفاتورة الأصلية');
      const items = picked.items
        .map((it, i) => ({ productId: it.product?.id ?? '', qty: num(retQty[i] ?? ''), price: it.price }))
        .filter((it) => it.productId && it.qty > 0);
      if (!items.length) return setError('اكتب الكمية المرتجعة لصنف واحد على الأقل');
      dto = {
        kind: picked.kind, date, partyId: picked.party!.id, warehouseId: picked.warehouse!.id,
        invoiceId: picked.id, items,
        refund: num(refund) || undefined, treasuryId: treasuryId || undefined, note: note || undefined,
      };
    } else {
      if (!partyId) return setError(isSale ? 'اختر العميل' : 'اختر المورد');
      if (!warehouseId) return setError('اختر المخزن');
      const items = lines
        .filter((l) => l.productId && num(l.qty) > 0)
        .map((l) => ({ productId: l.productId, qty: num(l.qty), price: num(l.price) }));
      if (!items.length) return setError('أضف صنفًا واحدًا على الأقل');
      dto = {
        kind, date, partyId, warehouseId, items,
        refund: num(refund) || undefined, treasuryId: treasuryId || undefined, note: note || undefined,
      };
    }
    if (num(refund) > 0 && !treasuryId) return setError('اخترت مبلغ استرداد — لازم تختار الخزنة');
    createReturn.mutate(dto, { onSuccess: () => onClose(), onError: (e: any) => setError(e.message) });
  };

  const refundLabel = isSale ? 'مبلغ يُرَدّ للعميل نقدًا (اختياري)' : 'مبلغ يُستَرَدّ من المورد نقدًا (اختياري)';

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={onClose}>→ رجوع</button>
      <PageTitle title="مرتجع جديد" subtitle="مرتجع بيع يرجّع البضاعة للمخزن ويقلّل رصيد العميل · مرتجع شراء يخرجها ويقلّل رصيد المورد" />
      <div className="card" onKeyDown={fieldNavKeyDown}>
        <div className="toolbar">
          <SegmentedControl
            value={mode}
            onChange={(v) => { setMode(v as 'invoice' | 'free'); setError(''); }}
            options={[{ value: 'invoice', label: 'من فاتورة' }, { value: 'free', label: 'مرتجع حر' }]}
          />
        </div>

        {mode === 'invoice' ? (
          <>
            <div className="form-grid">
              <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="ابحث عن الفاتورة" full>
                <SearchInput value={invSearch} onChange={setInvSearch} placeholder="رقم الفاتورة أو اسم الطرف…" />
              </Field>
              <Field label="اختر الفاتورة" full>
                <Combobox
                  options={(invData?.data ?? []).map((inv) => ({
                    id: inv.id,
                    name: `#${inv.no} — ${inv.party?.name ?? ''} · ${inv.kind === 'SALE' ? 'بيع' : 'شراء'}`,
                  }))}
                  value={picked?.id ?? ''}
                  onChange={pickInvoice}
                  placeholder="اكتب واختر الفاتورة…"
                />
              </Field>
            </div>

            {picked && (
              <>
                <div className="muted" style={{ padding: '0 16px 8px' }}>
                  {picked.kind === 'SALE' ? 'العميل' : 'المورد'}: <b>{picked.party?.name}</b> · المخزن: <b>{picked.warehouse?.name}</b> · النوع: <b>{picked.kind === 'SALE' ? 'مرتجع بيع' : 'مرتجع شراء'}</b>
                </div>
                <div className="tbl-wrap">
                  <table>
                    <thead><tr><th>الصنف</th><th style={{ width: 90 }}>المباع</th><th style={{ width: 100 }}>السعر</th><th style={{ width: 110 }}>مرتجع</th><th style={{ width: 110 }}>الإجمالي</th></tr></thead>
                    <tbody>
                      {picked.items.map((it, i) => (
                        <tr key={it.id ?? i}>
                          <td>{it.product?.name ?? '—'}</td>
                          <td className="num">{it.qty}</td>
                          <td className="num">{EGP(it.price)}</td>
                          <td>
                            <MoneyInput
                              value={retQty[i] ?? ''}
                              onChange={(v) => setRetQty((m) => ({ ...m, [i]: v }))}
                              placeholder="0"
                              style={{ width: 90 }}
                            />
                          </td>
                          <td className="num">{EGP(num(retQty[i] ?? '') * it.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="toolbar" style={{ marginTop: 4 }}>
              <SegmentedControl
                value={kind}
                onChange={(v) => { setKind(v as InvoiceKind); setPartyId(''); }}
                options={[{ value: 'SALE', label: 'مرتجع بيع (عميل)' }, { value: 'PURCHASE', label: 'مرتجع شراء (مورد)' }]}
              />
            </div>
            <div className="form-grid">
              <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label={isSale ? 'العميل' : 'المورد'}>
                <PartyCombobox parties={parties?.data ?? []} value={partyId} onChange={setPartyId} role={role} />
              </Field>
              <Field label="المخزن"><Combobox options={warehouses?.data ?? []} value={warehouseId} onChange={setWarehouseId} /></Field>
            </div>
            <div className="tbl-wrap combo-table">
              <table>
                <thead><tr><th>الصنف</th><th style={{ width: 90 }}>الكمية</th><th style={{ width: 110 }}>السعر</th><th style={{ width: 110 }}>الإجمالي</th><th></th></tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l._k}>
                      <td style={{ minWidth: 240 }}>
                        <ProductCombobox products={products?.data ?? []} value={l.productId} onChange={(id) => setLine(i, { productId: id })} />
                      </td>
                      <td><MoneyInput value={l.qty} onChange={(v) => setLine(i, { qty: v })} placeholder="0" style={{ width: 80 }} /></td>
                      <td><MoneyInput value={l.price} onChange={(v) => setLine(i, { price: v })} placeholder="0" style={{ width: 100 }} /></td>
                      <td className="num">{EGP(num(l.qty) * num(l.price))}</td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '10px 16px' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setLines((ls) => [...ls, blank()])}>+ إضافة صنف</button>
            </div>
          </>
        )}

        <div className="form-grid" style={{ borderTop: '1px solid var(--line-soft)' }}>
          <Field label={refundLabel}><MoneyInput value={refund} onChange={setRefund} placeholder="0.00" /></Field>
          {num(refund) > 0 && (
            <Field label="حساب الخزنة"><Combobox options={treasury?.data ?? []} value={treasuryId} onChange={setTreasuryId} /></Field>
          )}
          <Field label="البيان (اختياري)" full><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>

        <div className="page-title num" style={{ padding: '0 16px' }}>إجمالي المرتجع: {EGP(total)}</div>
        <div className="err-text" style={{ padding: '0 16px' }}>{error}</div>
        <div className="toolbar" style={{ padding: 16 }}>
          <button className="btn btn-primary" onClick={save} disabled={createReturn.isPending}>
            {createReturn.isPending ? '...' : 'حفظ المرتجع'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </>
  );
}
