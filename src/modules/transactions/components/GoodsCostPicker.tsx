'use client';

import { EGP, fmtDate } from '@/lib/format';
import { Field, MoneyInput } from '@/components/common';
import { useInvoices } from '../../invoices/hooks';
import { useAllProducts } from '../../products/hooks';
import { ProductCombobox } from '../../products/components/ProductCombobox';
import type { GoodsMode, GoodsItem } from '../dtos';

interface Props {
  mode: GoodsMode;
  setMode: (m: GoodsMode) => void;
  invoiceIds: string[];
  setInvoiceIds: (ids: string[]) => void;
  goodsItems: GoodsItem[];
  setGoodsItems: (items: GoodsItem[]) => void;
}

const MODES: { m: GoodsMode; label: string }[] = [
  { m: 'invoices', label: 'على فواتير' },
  { m: 'products', label: 'على أصناف' },
  { m: 'count', label: 'عدد أصناف' },
];

export function GoodsCostPicker({ mode, setMode, invoiceIds, setInvoiceIds, goodsItems, setGoodsItems }: Props) {
  const { data: invoices } = useInvoices({ kind: 'PURCHASE', take: 60 });
  const { data: products } = useAllProducts();
  const prodName = (id: string) => products?.data.find((p) => p.id === id)?.name ?? '';

  const toggleInvoice = (id: string) =>
    setInvoiceIds(invoiceIds.includes(id) ? invoiceIds.filter((x) => x !== id) : [...invoiceIds, id]);
  const addProduct = (id: string) => {
    if (!id || goodsItems.some((g) => g.productId === id)) return;
    setGoodsItems([...goodsItems, { productId: id, count: undefined }]);
  };
  const removeProduct = (id: string) => setGoodsItems(goodsItems.filter((g) => g.productId !== id));
  const setCount = (id: string, count: string) =>
    setGoodsItems(goodsItems.map((g) => (g.productId === id ? { ...g, count: Number(count) || undefined } : g)));

  return (
    <Field label="توزيع الصرف على البضاعة (يرفع صافي سعر التكلفة)" full>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {MODES.map((x) => (
          <button key={x.m} type="button" className={`btn btn-sm ${mode === x.m ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode(x.m)}>{x.label}</button>
        ))}
      </div>

      {mode === 'invoices' && (
        <div style={{ border: '1.5px solid var(--line)', borderRadius: 8, maxHeight: 220, overflowY: 'auto' }}>
          {(invoices?.data ?? []).length === 0 ? (
            <div className="muted" style={{ padding: 10, fontSize: 13 }}>لا توجد فواتير شراء</div>
          ) : (
            (invoices?.data ?? []).map((inv) => {
              const total = inv.items.reduce((s, it) => s + it.qty * it.price, 0);
              return (
                <label key={inv.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid var(--line-soft)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={invoiceIds.includes(inv.id)} onChange={() => toggleInvoice(inv.id)} />
                  <span style={{ fontWeight: 700 }}>#{inv.no}</span>
                  <span className="muted" style={{ fontSize: 13 }}>{inv.party?.name ?? '—'}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{fmtDate(inv.date)}</span>
                  <span className="num" style={{ marginInlineStart: 'auto', fontSize: 13 }}>{EGP(total)}</span>
                </label>
              );
            })
          )}
          {invoiceIds.length > 0 && <div style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700 }}>مختار: {invoiceIds.length} فاتورة</div>}
        </div>
      )}

      {(mode === 'products' || mode === 'count') && (
        <div>
          <div style={{ maxWidth: 320, marginBottom: 8 }}>
            <ProductCombobox key={goodsItems.length} products={products?.data ?? []} value="" onChange={addProduct} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {goodsItems.map((g) => (
              <div key={g.productId} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--accent-soft)', borderRadius: 8, padding: '5px 10px' }}>
                <span style={{ fontWeight: 700, flex: 1 }}>{prodName(g.productId)}</span>
                {mode === 'count' && (
                  <>
                    <span className="muted" style={{ fontSize: 12 }}>العدد</span>
                    <MoneyInput value={g.count ? String(g.count) : ''} onChange={(v) => setCount(g.productId, v)} placeholder="0" style={{ width: 80 }} />
                  </>
                )}
                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeProduct(g.productId)}>×</button>
              </div>
            ))}
            {goodsItems.length === 0 && <div className="muted" style={{ fontSize: 12.5 }}>اختر الأصناف من القائمة فوق</div>}
          </div>
        </div>
      )}
    </Field>
  );
}
