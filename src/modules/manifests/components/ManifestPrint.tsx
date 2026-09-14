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

  // بيانات الكشف: ٣×٣ على الورقة، وبتتفرد سطر ورا سطر على الموبايل (شوف .pr-info
  // في globals.css). الترتيب هنا هو ترتيب القراية على الموبايل بالظبط.
  const info: [string, string | null | undefined][] = [
    ['التاريخ', fmtDate(m.date)],
    ['اسم العميل', m.clientName],
    ['اسم السائق', m.driverName],
    ['الرقم القومي', m.driverNID],
    ['تليفون السائق', m.driverPhone],
    ['مسمّى العربية', m.vehicleLabel],
    ['رقم العربية', m.vehicleNo],
    ['رقم المقطورة', m.trailerNo],
    ['ملاحظات', m.note],
  ];

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
        {/* الديزاين القديم (app_4.html): ترويسة اسم الشركة + العنوان ورقم الكشف،
            جدول بيانات ٣ أعمدة، جدول الأصناف (م / الاصناف / العدد)، والإقرار.
            نفس شكل كشف الاستلام في بوابة العميل (mf-old) — الاتنين بقوا متطابقين. */}
        <div className="card print-sheet mf-old mf-plain" ref={innerRef}>
          <div className="pr-head">
            <div className="co">أبو شامة</div>
            <div className="ttl"><b>كشف استلام بضاعة</b><br />رقم: {m.no}</div>
          </div>

          {/* ٩ خانات في ٣×٣ — من غير خلية فاضية، والملاحظات جوّه الجدول بدل سطر لوحده */}
          <table className="pr pr-info">
            <tbody>
              {[0, 3, 6].map((start) => (
                <tr key={start}>
                  {info.slice(start, start + 3).map(([label, value]) => (
                    <td key={label}><b>{label}:</b> <span>{value || ''}</span></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="tbl-wrap mf-grow">
            <table className="pr">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>م</th>
                  <th>الاصناف</th>
                  <th style={{ width: 110 }}>العدد</th>
                </tr>
              </thead>
              <tbody>
                {m.items.map((it, i) => (
                  <tr key={it.id ?? i}>
                    <td className="num">{i + 1}</td>
                    <td>{it.name}</td>
                    <td className="num">{it.qty}</td>
                  </tr>
                ))}
                {m.items.length === 0 && (
                  <tr><td colSpan={3} className="empty">مفيش أصناف في الكشف</td></tr>
                )}
                <tr className="mf-total">
                  <td />
                  <td><b>إجمالي العدد</b></td>
                  <td className="num"><b>{totalQty}</b></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pr-ack">
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
