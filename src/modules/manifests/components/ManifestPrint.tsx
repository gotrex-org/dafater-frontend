'use client';

import { useEffect, useRef, useState } from 'react';
import { fmtDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { downloadElementAsPdf } from '@/lib/pdf';
import { Spinner } from '@/components/common';
import { useManifest, useDeleteManifest } from '../hooks';
import { ManifestEditor } from './ManifestEditor';

const DOTS = '..........................';
// full A4 at 96dpi (210mm × 297mm) — the sheet is sized to fill the whole page
const PAGE_W = 794;
const PAGE_H = 1123;

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="mf-info">
      <span className="mf-info-l">{label}</span>
      <span className="mf-info-v">{value || '—'}</span>
    </div>
  );
}

export function ManifestPrint({ id, onClose }: { id: string; onClose: () => void }) {
  const { can } = useAuth();
  const { data: m, isLoading } = useManifest(id);
  const deleteManifest = useDeleteManifest();
  const [editing, setEditing] = useState(false);
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
  }, [m]);

  if (isLoading || !m) return <Spinner />;
  const totalQty = m.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);

  const handleDelete = () => {
    if (!window.confirm(`حذف كشف رقم ${m.no}؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    deleteManifest.mutate(m.id, { onSuccess: onClose });
  };

  if (editing) return <ManifestEditor manifest={m} onClose={() => setEditing(false)} onCreated={() => setEditing(false)} />;

  return (
    <>
      <div className="toolbar no-print">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>→ رجوع لقائمة الكشوفات</button>
        {can('manifests.edit') && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>تعديل</button>}
        {can('manifests.delete') && <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleteManifest.isPending}>حذف</button>}
        {can('manifests.print') && <button className="btn btn-ghost btn-sm sp" onClick={() => innerRef.current && downloadElementAsPdf(innerRef.current, `كشف-${m.no}`)}>⬇ تحميل PDF</button>}
        {can('manifests.print') && <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 طباعة الكشف</button>}
      </div>

      <div className="print-scale" ref={outerRef}>
        <div className="card print-sheet mf-lines" ref={innerRef}>
          <div className="mf-logo">أبو شامة</div>
          <div className="mf-head">
            <h2>كشف استلام بضاعة</h2>
            <div className="mf-meta">
              <span>رقم: <b>{m.no}</b></span>
              <span>التاريخ: <b>{fmtDate(m.date)}</b></span>
            </div>
          </div>

          <div className="mf-grid">
            <Info label="اسم العميل" value={m.clientName} />
            <Info label="اسم السائق" value={m.driverName} />
            <Info label="الرقم القومي للسائق" value={m.driverNID} />
            <Info label="رقم تليفون السائق" value={m.driverPhone} />
            <Info label="مسمّى العربية" value={m.vehicleLabel} />
            <Info label="رقم العربية" value={m.vehicleNo} />
            <Info label="رقم المقطورة" value={m.trailerNo} />
          </div>

          <div className="tbl-wrap mf-grow">
            <table>
              <thead><tr><th style={{ width: 120 }}>الكمية</th><th>الصنف</th></tr></thead>
              <tbody>
                {m.items.map((it, i) => (
                  <tr key={it.id ?? i}>
                    <td className="num">{it.qty}</td>
                    <td>{it.name}</td>
                  </tr>
                ))}
                <tr className="mf-total">
                  <td className="num"><b>{totalQty}</b></td>
                  <td><b>إجمالي العدد</b></td>
                </tr>
              </tbody>
            </table>
          </div>

          {m.note && <p className="mf-note">ملاحظات: {m.note}</p>}

          <div className="mf-ack">
            <p>
              أقر أنا / <b>{DOTS}</b> باستلام البضاعة المذكورة أعلاه،
              وأتعهد بالحفاظ على البضاعة المستلمة في حالتها الجيدة، والالتزام بتوصيلها إلى
              الجهة المحددة، كما أتعهد برد قيمة أي عجز أو تلف أو فقد يحدث بها لأي سبب يرجع لي.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
