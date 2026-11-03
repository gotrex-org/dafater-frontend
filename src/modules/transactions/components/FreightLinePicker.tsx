'use client';

import { useEffect, useState } from 'react';
import { fmtDate, QTY } from '@/lib/format';
import { useFreightLines } from '../hooks';
import type { FreightLine } from '../dtos';

/**
 * اختيار اختياري لصنف من فاتورة شراء، لتحميل الناولون الداخلي على تكلفته.
 * يكتب المستخدم اسم الصنف فتظهر فواتير الشراء التي فيها هذا الصنف.
 */
export function FreightLinePicker({ value, onChange }: { value: FreightLine | null; onChange: (line: FreightLine | null) => void }) {
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const { data: lines, isFetching } = useFreightLines(search);

  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
        <b>{value.productName}</b>
        <span className="muted">فاتورة شراء رقم {value.invoiceNo} — {value.supplierName} — {fmtDate(value.date)}</span>
        <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--debit)' }} onClick={() => onChange(null)}>×</button>
      </div>
    );
  }

  return (
    <div>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب اسم الصنف" />
      {search.length >= 2 && (
        <div style={{ marginTop: 6, display: 'grid', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
          {isFetching && !lines && <div className="muted" style={{ fontSize: 12 }}>جاري البحث…</div>}
          {lines?.length === 0 && <div className="muted" style={{ fontSize: 12 }}>لا توجد فواتير شراء لهذا الصنف</div>}
          {lines?.map((l) => (
            <button
              key={`${l.invoiceId}:${l.productId}`}
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ justifyContent: 'flex-start', textAlign: 'start', whiteSpace: 'normal', fontWeight: 500 }}
              onClick={() => { onChange(l); setText(''); setSearch(''); }}
            >
              <b>{l.productName}</b>&nbsp;— فاتورة شراء رقم {l.invoiceNo} — {l.supplierName} — {fmtDate(l.date)} — الكمية {QTY(l.qty)}{l.unit ? ` ${l.unit}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
