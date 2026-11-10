'use client';

import { useState } from 'react';
import { EGP, QTY, fmtDate } from '@/lib/format';
import { Spinner } from '@/components/common';
import { useDecideInvoiceEdit, useInvoiceEditRequest, useInvoiceEditRequests } from '../hooks';
import type { InvoiceEditSnapshot } from '../dtos';

const kindLabel = (k: 'SALE' | 'PURCHASE') => (k === 'SALE' ? 'فاتورة بيع' : 'فاتورة شراء');

/**
 * تعديلات الفواتير من غير المالك: قايمة بالمعلّق، ولكل تعديل الفاتورة الحالية جنب
 * التعديل المطلوب، وزرار موافقة (يتطبّق) أو رفض (يتمسح والفاتورة تفضل زي ما هي).
 */
export function InvoiceEditRequests() {
  const { data, isLoading } = useInvoiceEditRequests();
  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading || !data) return <Spinner />;
  if (openId) return <EditDetail id={openId} onBack={() => setOpenId(null)} />;
  if (!data.length) return <div className="muted" style={{ padding: 16 }}>لا توجد تعديلات بانتظار الموافقة.</div>;

  return (
    <div className="card tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>الفاتورة</th>
            <th>الطرف</th>
            <th>عدّلها</th>
            <th>وقت التعديل</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(r.id)} title="اضغط لعرض التعديل">
              <td><b>{kindLabel(r.kind)} #{r.invoiceNo}</b></td>
              <td>{r.partyName}</td>
              <td>{r.requestedBy ?? '—'}</td>
              <td className="muted" style={{ fontSize: 12 }}>{fmtDate(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading } = useInvoiceEditRequest(id);
  const decide = useDecideInvoiceEdit();
  const [error, setError] = useState('');

  if (isLoading || !data) return <Spinner />;

  const act = (approve: boolean) => {
    const msg = approve ? 'الموافقة على التعديل وتطبيقه على الفاتورة؟' : 'رفض التعديل؟ الفاتورة تبقى كما هي.';
    if (!window.confirm(msg)) return;
    setError('');
    decide.mutate({ id, approve }, { onSuccess: onBack, onError: (e: any) => setError(e.message) });
  };

  return (
    <>
      <div className="toolbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← رجوع</button>
        <b>{kindLabel(data.kind)} #{data.invoiceNo}</b>
        <span className="muted" style={{ fontSize: 12 }}>عدّلها {data.requestedBy ?? '—'} — {fmtDate(data.createdAt)}</span>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Snapshot title="الفاتورة الآن" s={data.before} other={data.after} />
        <Snapshot title="بعد التعديل" s={data.after} other={data.before} highlight />
      </div>

      {error && <div className="err-text" style={{ marginTop: 8 }}>{error}</div>}

      <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
        <button className="btn btn-primary" disabled={decide.isPending} onClick={() => act(true)}>موافقة وتطبيق</button>
        <button className="btn btn-ghost" style={{ color: 'var(--debit)' }} disabled={decide.isPending} onClick={() => act(false)}>رفض</button>
      </div>
    </>
  );
}

/** نسخة من الفاتورة — في «بعد التعديل» الحاجة اللي اتغيّرت بتتعلّم. */
function Snapshot({ title, s, other, highlight = false }:
  { title: string; s: InvoiceEditSnapshot; other: InvoiceEditSnapshot; highlight?: boolean }) {
  const mark = (changed: boolean) => (highlight && changed ? { background: 'var(--gold-soft, #fff4d6)' } : undefined);
  const NUM = { textAlign: 'center' as const };
  const row = (label: string, value: string, changed: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', ...mark(changed) }}>
      <span className="muted">{label}</span><b>{value}</b>
    </div>
  );
  const lines = (list: InvoiceEditSnapshot['items'], otherList: InvoiceEditSnapshot['items']) =>
    list.map((l, i) => {
      const o = otherList[i];
      const changed = !o || o.name !== l.name || o.qty !== l.qty || o.price !== l.price;
      return (
        <tr key={i} style={mark(changed)}>
          <td style={{ whiteSpace: 'normal' }}>{l.name}</td>
          <td className="num" style={NUM}>{QTY(l.qty)}</td>
          <td className="num" style={NUM}>{EGP(l.price)}</td>
          <td className="num" style={NUM}>{EGP(l.qty * l.price)}</td>
        </tr>
      );
    });

  return (
    <div className="card" style={{ flex: '1 1 340px', padding: 12, minWidth: 0 }}>
      <b style={{ display: 'block', marginBottom: 8 }}>{title}</b>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        {row('التاريخ', fmtDate(s.date), fmtDate(s.date) !== fmtDate(other.date))}
        {row('الطرف', s.partyName, s.partyName !== other.partyName)}
        {row('المخزن', s.warehouseName, s.warehouseName !== other.warehouseName)}
        {s.fake && row('النوع', 'وهمية', !other.fake)}
      </div>
      <div className="tbl-wrap">
        <table style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col /><col style={{ width: '17%' }} /><col style={{ width: '22%' }} /><col style={{ width: '24%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>الصنف</th>
              <th className="num" style={NUM}>الكمية</th>
              <th className="num" style={NUM}>السعر</th>
              <th className="num" style={NUM}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {lines(s.items, other.items)}
            {lines(s.charges, other.charges)}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 13, marginTop: 8 }}>
        {row('الإجمالي', EGP(s.total), s.total !== other.total)}
        {s.discount > 0 && row('الخصم', EGP(s.discount), s.discount !== other.discount)}
        {row('المدفوع', EGP(s.paid), s.paid !== other.paid)}
        {s.note && row('ملاحظة', s.note, s.note !== other.note)}
      </div>
    </div>
  );
}
