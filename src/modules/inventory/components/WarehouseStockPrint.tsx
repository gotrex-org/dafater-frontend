'use client';

import { useEffect, useMemo, useRef } from 'react';
import { EGP, QTY, fmtDate, todayISO } from '@/lib/format';
import { downloadElementAsPdf } from '@/lib/pdf';
import { Spinner } from '@/components/common';
import { useWarehouseStock } from '../../warehouses/hooks';

// full A4 at 96dpi (210mm × 297mm) — the sheet is sized to fill the whole page
const PAGE_W = 794;
const PAGE_H = 1123;

interface Props {
  warehouseId: string;
  warehouseName: string;
  onClose: () => void;
}

export function WarehouseStockPrint({ warehouseId, warehouseName, onClose }: Props) {
  const { data: rows, isLoading } = useWarehouseStock(warehouseId);
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // scale the sheet so it always fits (and fills) exactly one printed page
  useEffect(() => {
    const outer = outerRef.current, inner = innerRef.current;
    if (!outer || !inner) return;
    const fit = () => {
      inner.style.transform = 'none';
      outer.style.height = ''; outer.style.width = '';
      const h = inner.scrollHeight, w = inner.scrollWidth;
      const scale = Math.min(1, PAGE_H / h, PAGE_W / w); // only shrink when content overflows one page
      inner.style.transformOrigin = 'top right';
      inner.style.transform = `scale(${scale})`;
      outer.style.height = `${h * scale}px`;
      outer.style.width = `${w * scale}px`;
    };
    const reset = () => { inner.style.transform = 'none'; outer.style.height = ''; outer.style.width = ''; };
    window.addEventListener('beforeprint', fit);
    window.addEventListener('afterprint', reset);
    return () => { window.removeEventListener('beforeprint', fit); window.removeEventListener('afterprint', reset); };
  }, [rows]);

  const sorted = useMemo(
    () => (rows ?? []).filter((r) => r.qty !== 0).sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [rows],
  );
  const totalValue = sorted.reduce((s, r) => s + r.value, 0);

  if (isLoading || !rows) return <Spinner />;

  return (
    <>
      <div className="toolbar no-print">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>→ رجوع للمخازن</button>
        <button className="btn btn-ghost btn-sm sp" onClick={() => innerRef.current && downloadElementAsPdf(innerRef.current, `رصيد-مخزن-${warehouseName}`)}>⬇ تحميل PDF</button>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 طباعة رصيد المخزن</button>
      </div>

      <div className="print-scale" ref={outerRef}>
        <div className="card print-sheet" ref={innerRef}>
          <div className="mf-logo">أبو شامة</div>
          <div className="mf-head">
            <h2>رصيد المخزن</h2>
            <div className="mf-meta">
              <span>المخزن: <b>{warehouseName}</b></span>
              <span>التاريخ: <b>{fmtDate(todayISO())}</b></span>
            </div>
          </div>

          <div className="tbl-wrap mf-grow">
            <table>
              <thead>
                <tr><th>الصنف</th><th>الوحدة</th><th style={{ width: 110 }}>الرصيد</th><th style={{ width: 120 }}>متوسط التكلفة</th><th style={{ width: 120 }}>القيمة</th></tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.productId}>
                    <td>{r.name}</td>
                    <td className="muted">{r.unit || '—'}</td>
                    <td className="num">{QTY(r.qty)}</td>
                    <td className="num muted">{EGP(r.cost)}</td>
                    <td className="num">{EGP(r.value)}</td>
                  </tr>
                ))}
                <tr className="mf-total">
                  <td colSpan={4}><b>إجمالي قيمة المخزن</b></td>
                  <td className="num"><b>{EGP(totalValue)}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
