'use client';

import { useState } from 'react';
import { EGP, QTY, USD, fmtDate } from '@/lib/format';
import { PageTitle, DataTable, Spinner, SegmentedControl, Combobox, StatsGrid, StatCard, type Column } from '@/components/common';
import { useProductMovements, useProductStock, useAllProducts, useUpdateProduct } from '../../products/hooks';
import type { ProductMovement } from '../../products/dtos';

const KIND_LABEL: Record<ProductMovement['kind'], string> = {
  PURCHASE: 'دخول (شراء)',
  SALE: 'خروج (بيع)',
  SALE_RETURN: 'دخول (مرتجع بيع)',
  PURCHASE_RETURN: 'خروج (مرتجع شراء)',
  ADJUSTMENT_IN: 'دخول (تسوية مخزن)',
  ADJUSTMENT_OUT: 'خروج (تسوية مخزن)',
  LOAN: 'خروج (إعارة)',
  LOAN_RETURN: 'دخول (رجوع إعارة)',
};
const IN_KINDS = new Set<ProductMovement['kind']>(['PURCHASE', 'SALE_RETURN', 'ADJUSTMENT_IN', 'LOAN_RETURN']);

export function ProductMovements({ productId, name, onBack, backLabel = 'رجوع للمخزن' }: {
  productId: string;
  name: string;
  onBack: () => void;
  /** الكارت بيتفتح من المخزن ومن شاشة الأصناف كمان — فزرار الرجوع بيتسمّى حسب اللي جاي منه */
  backLabel?: string;
}) {
  const { data = [], isLoading } = useProductMovements(productId);
  const { data: stock } = useProductStock(productId);
  const { data: products } = useAllProducts();
  const updateProduct = useUpdateProduct();
  const product = products?.data.find((p) => p.id === productId);
  const [tab, setTab] = useState<'all' | 'in' | 'out'>('all');
  const [q, setQ] = useState('');

  const bought = data.filter((r) => r.kind === 'PURCHASE').reduce((s, r) => s + r.qty, 0);
  const sold = data.filter((r) => r.kind === 'SALE').reduce((s, r) => s + r.qty, 0);

  const persons = Array.from(new Set(data.map((r) => r.party).filter(Boolean))).map((n) => ({ id: n as string, name: n as string }));
  const filtered = data.filter((r) =>
    (tab === 'all' || (tab === 'in' && IN_KINDS.has(r.kind)) || (tab === 'out' && !IN_KINDS.has(r.kind))) &&
    (!q.trim() || (r.party ?? '').includes(q.trim())),
  );

  const cols: Column<ProductMovement>[] = [
    { header: 'التاريخ', cell: (r) => fmtDate(r.date), className: 'muted' },
    {
      header: 'الحركة',
      cell: (r) => (
        <span className={IN_KINDS.has(r.kind) ? 'cre' : 'deb'}>
          {KIND_LABEL[r.kind]}
          {r.fake && <span className="muted" style={{ fontSize: 11 }}> (وهمية)</span>}
        </span>
      ),
    },
    { header: 'الطرف', cell: (r) => <b>{r.party ?? '—'}</b> },
    { header: 'المخزن', cell: (r) => r.warehouse ?? '—', className: 'muted' },
    { header: 'الكمية', cell: (r) => QTY(r.qty), className: 'num' },
    {
      header: 'السعر بالمصري',
      cell: (r) => {
        if (r.price == null) return <span className="muted">—</span>;
        const usd = r.currency === 'USD' ? <span className="muted" style={{ fontSize: 11, display: 'block' }}>({USD(r.price)})</span> : null;
        if (r.priceEgp == null) return <span className="deb" style={{ fontSize: 12 }}>غير مسعّر{usd}</span>;
        return <>{EGP(r.priceEgp)}{usd}</>;
      },
      className: 'num',
    },
    {
      header: 'الرصيد بعدها',
      cell: (r) => r.balance == null
        ? <span className="muted">—</span>
        : <span className={r.balance < 0 ? 'deb' : ''}>{QTY(r.balance)}</span>,
      className: 'num',
    },
  ];

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={onBack}>→ {backLabel}</button>
      <PageTitle title={`تقرير الصنف: ${name}`} subtitle="كل حركة بسعرها بالمصري ورصيد الصنف بعدها في كل المخازن" />

      {product !== undefined && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg2)', borderRadius: 8, cursor: 'pointer', marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={!!product.service}
            onChange={() => updateProduct.mutate({ id: productId, dto: { service: !product.service } })}
          />
          <span style={{ fontSize: 13 }}>
            بند خدمة (بدون مخزون)
            <span className="muted" style={{ marginInlineStart: 6, fontSize: 12 }}>
              — لو علّمتها، الصنف هيختفي من شاشة المخزن؛ وترجّعها من الإعدادات ← الأصناف
            </span>
          </span>
        </label>
      )}

      {/* «الموجود حاليًا» جاي من رصيد المخزن الحقيقي مش من (مشترى − مُباع) — فبيحسب
          كمان المرتجعات والتسويات والبضاعة المعارة اللي لسه بره. */}
      <StatsGrid columns={3}>
        <StatCard
          variant={(stock?.onHand ?? 0) < 0 ? 'debit' : 'accent'}
          label="الموجود حاليًا (كل المخازن)"
          value={stock ? `${QTY(stock.onHand)} ${product?.unit ?? ''}`.trim() : '…'}
        />
        <StatCard variant="blue" label="إجمالي المشترى (دخول)" value={QTY(bought)} />
        <StatCard variant="gold" label="إجمالي المُباع (خروج)" value={QTY(sold)} />
      </StatsGrid>

      <div className="toolbar">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[{ value: 'all', label: 'الكل' }, { value: 'in', label: 'جه من (شراء)' }, { value: 'out', label: 'طلع لـ (بيع)' }]}
        />
        <div style={{ minWidth: 200 }}><Combobox options={persons} value={q} onChange={setQ} placeholder="اكتب واختر شخص…" /></div>
      </div>

      {isLoading ? <Spinner /> : <DataTable columns={cols} rows={filtered} rowKey={(r) => r.id} emptyText="لا توجد حركات لهذا الصنف" />}
    </>
  );
}
