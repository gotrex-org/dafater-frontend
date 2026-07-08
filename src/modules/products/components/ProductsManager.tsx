'use client';

import { useEffect, useState } from 'react';
import { useTableState } from '@/lib/useTableState';
import { EGP } from '@/lib/format';
import { SearchInput, MoneyInput } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../hooks';
import { confirmCascadeDelete } from '@/lib/cascadeDelete';
import type { Product } from '../dtos';

function ProductRow({ product, canManage }: { product: Product; canManage: boolean }) {
  const update = useUpdateProduct();
  const del = useDeleteProduct();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product.name);
  const [unit, setUnit] = useState(product.unit ?? '');
  const [service, setService] = useState(!!product.service);
  const [price, setPrice] = useState(product.price ? String(product.price) : '');
  const [msg, setMsg] = useState('');

  const save = () => {
    if (!name.trim()) return setMsg('اكتب الاسم');
    update.mutate(
      { id: product.id, dto: { name: name.trim(), unit: unit.trim() || undefined, service, price: Number(price) || 0 } },
      { onSuccess: () => { setMsg('تم الحفظ ✓'); setOpen(false); }, onError: (e: any) => setMsg(e.message) },
    );
  };

  const remove = () => {
    if (!confirm(`حذف ${product.name}؟ لا يمكن التراجع.`)) return;
    confirmCascadeDelete(del, product.id, { onOtherError: (e) => setMsg(e.message) });
  };

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, fontWeight: 700, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          {product.name}
          {product.unit && <span className="muted" style={{ fontSize: 12, fontWeight: 400, marginInlineStart: 8 }}>({product.unit})</span>}
          {product.service && <span className="pill" style={{ marginInlineStart: 6 }}>خدمة</span>}
          {!!product.price && <span className="muted num" style={{ fontSize: 12, fontWeight: 400, marginInlineStart: 8 }}>سعر التقييم: {EGP(product.price)}</span>}
        </span>
        {canManage && <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>{open ? 'إغلاق' : 'تعديل'}</button>}
        {canManage && <button className="btn btn-danger btn-sm" onClick={remove} disabled={del.isPending}>حذف</button>}
      </div>
      {open && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 130 }} />
          <input placeholder="الوحدة (اختياري)" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ maxWidth: 140 }} />
          <MoneyInput value={price} onChange={setPrice} placeholder="سعر التقييم" style={{ maxWidth: 140 }} />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <input type="checkbox" checked={service} onChange={(e) => setService(e.target.checked)} />
            بند خدمة (بدون مخزون)
          </label>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={update.isPending}>حفظ</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>إلغاء</button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      )}
    </div>
  );
}

export function ProductsManager() {
  const { user, can } = useAuth();
  const [search, setSearch] = useState('');
  const { page, setPage, pageSize } = useTableState();
  const { data, isLoading } = useProducts({ all: true });
  const createProduct = useCreateProduct();
  const [adding, setAdding] = useState(false);
  const [pName, setPName] = useState('');
  const [pUnit, setPUnit] = useState('');
  const [pService, setPService] = useState(false);
  const [pPrice, setPPrice] = useState('');
  const [pErr, setPErr] = useState('');

  const canManage = !!user?.admin || can('settings');

  const addProduct = () => {
    if (!pName.trim()) { setPErr('اكتب الاسم'); return; }
    setPErr('');
    createProduct.mutate(
      { name: pName.trim(), unit: pUnit.trim() || undefined, service: pService, price: Number(pPrice) || 0 },
      { onSuccess: () => { setPName(''); setPUnit(''); setPService(false); setPPrice(''); setAdding(false); }, onError: (e: any) => setPErr(e.message) },
    );
  };

  useEffect(() => { setPage(1); }, [search]);

  const all: Product[] = data?.data ?? [];
  const filtered = all
    .filter((p) => !search.trim() || p.name.includes(search.trim()))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم…" />
        {!adding && canManage && (
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>+ صنف جديد</button>
        )}
      </div>

      {adding && (
        <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input autoFocus placeholder="اسم الصنف" value={pName} onChange={(e) => setPName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addProduct(); if (e.key === 'Escape') setAdding(false); }}
            style={{ flex: 1, minWidth: 150 }} />
          <input placeholder="الوحدة (اختياري)" value={pUnit} onChange={(e) => setPUnit(e.target.value)} style={{ maxWidth: 150 }} />
          <MoneyInput value={pPrice} onChange={setPPrice} placeholder="سعر التقييم (اختياري)" style={{ maxWidth: 150 }} />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <input type="checkbox" checked={pService} onChange={(e) => setPService(e.target.checked)} />
            بند خدمة (بدون مخزون)
          </label>
          <button className="btn btn-primary btn-sm" onClick={addProduct} disabled={createProduct.isPending}>حفظ</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setPName(''); setPErr(''); }}>إلغاء</button>
          {pErr && <span className="err-text">{pErr}</span>}
        </div>
      )}

      <div>
        {isLoading && <div className="empty">جاري التحميل…</div>}
        {!isLoading && pageRows.length === 0 && <div className="empty">لا يوجد</div>}
        {pageRows.map((p) => <ProductRow key={p.id} product={p} canManage={canManage} />)}
      </div>

      {total > pageSize && (
        <div className="toolbar" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</button>
          <span className="muted" style={{ fontSize: 13 }}>{page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>التالي</button>
        </div>
      )}
    </>
  );
}
