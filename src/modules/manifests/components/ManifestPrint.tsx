'use client';

import { useEffect, useRef, useState } from 'react';
import { EGP, fmtDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { downloadElementAsPdf } from '@/lib/pdf';
import { Spinner } from '@/components/common';
import { RecordOpener } from '../../records/RecordOpener';
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
  const [openRec, setOpenRec] = useState<{ entity: string; uid: string } | null>(null);
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

  // كشف خارج من مكتب شحن — اسم المكتب لازم يتكتب على الورقة.
  const fromOffice = m.vehicleSource === 'CLIENT_OFFICE';

  const handleDelete = () => {
    if (!window.confirm(`حذف كشف رقم ${m.no}؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    deleteManifest.mutate(m.id, { onSuccess: onClose });
  };

  if (editing) return <ManifestEditor manifest={m} onClose={() => setEditing(false)} onCreated={() => setEditing(false)} />;
  // فتح أي حلقة من السلسلة بيبدّل الصفحة بسجلها، والرجوع بيرجّعنا للكشف.
  if (openRec) {
    return <RecordOpener entity={openRec.entity} uid={openRec.uid} onClose={() => setOpenRec(null)} />;
  }

  const trip = m.driverTrips?.find((t) => t.uid);
  const fromOfficeChain = m.vehicleSource === 'CLIENT_OFFICE';

  return (
    <>
      <div className="toolbar no-print">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>→ رجوع لقائمة الكشوفات</button>
        {can('manifests.edit') && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>تعديل</button>}
        {can('manifests.delete') && <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleteManifest.isPending}>حذف</button>}
        {can('manifests.print') && <button className="btn btn-ghost btn-sm sp" onClick={() => innerRef.current && downloadElementAsPdf(innerRef.current, `كشف-${m.no}`)}>⬇ تحميل PDF</button>}
        {can('manifests.print') && <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 طباعة الكشف</button>}
      </div>

      {/* شريط السلسلة: الفاتورة · كشف العربية · رحلة السائق · التخليص.
          كل حلقة موجودة بتفتح سجلها، والناقصة بتقول إنها ناقصة. no-print
          عشان ماتطلعش في الورقة المطبوعة. */}
      <div className="chain-bar no-print">
        {m.invoice ? (
          <button className="chain-chip" onClick={() => setOpenRec({ entity: 'invoices', uid: m.invoice!.id })}>
            <span className="l">الفاتورة</span>
            <b>{m.invoice.kind === 'SALE' ? 'بيع' : 'شراء'} {m.invoice.no}</b>
          </button>
        ) : (
          <span className="chain-chip is-empty"><span className="l">الفاتورة</span><b>مش مربوط</b></span>
        )}

        <span className="chain-sep" aria-hidden="true" />

        <span className="chain-chip is-current"><span className="l">كشف العربية</span><b>{m.no}</b></span>

        <span className="chain-sep" aria-hidden="true" />

        {trip ? (
          <button className="chain-chip" onClick={() => setOpenRec({ entity: 'driver-trips', uid: trip.uid! })}>
            <span className="l">رحلة السائق</span>
            <b>{trip.driverName || '—'} · {trip.arrivalDate ? 'كمّلت' : 'في الطريق'}</b>
          </button>
        ) : (
          <span className="chain-chip is-empty">
            <span className="l">رحلة السائق</span>
            <b>{fromOfficeChain ? 'مكتب شحن' : 'مافيش رحلة'}</b>
          </span>
        )}

        <span className="chain-sep" aria-hidden="true" />

        {m.clearance?.agent ? (
          <button className="chain-chip" onClick={() => setOpenRec({ entity: 'parties', uid: m.clearance!.agent!.uid })}>
            <span className="l">التخليص</span>
            <b>{EGP(m.clearance.total)} · {m.clearance.agent.name}</b>
          </button>
        ) : (
          <span className="chain-chip is-empty">
            <span className="l">التخليص</span>
            <b>{fromOfficeChain ? 'مكتب شحن' : 'مافيش تخليص'}</b>
          </span>
        )}
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

          {/* صف: العميل والتاريخ · صف: السائق وبياناته · صف: العربية وأرقامها.
              لما الخروج من مكتب شحن بيتزاد اسم المكتب في الصف الأول، والعميل
              بياخد خانتين بدل واحدة لما مافيش مكتب. */}
          <table className="pr pr-info">
            <tbody>
              <tr>
                <td colSpan={fromOffice ? 1 : 2}><b>اسم العميل:</b> <span>{m.clientName || ''}</span></td>
                <td><b>التاريخ:</b> <span>{fmtDate(m.date)}</span></td>
                {fromOffice && (
                  <td><b>مكتب الشحن:</b> <span>{m.shippingOffice || ''}</span></td>
                )}
              </tr>
              <tr>
                <td><b>اسم السائق:</b> <span>{m.driverName || ''}</span></td>
                <td><b>الرقم القومي:</b> <span>{m.driverNID || ''}</span></td>
                <td><b>رقم التليفون:</b> <span>{m.driverPhone || ''}</span></td>
              </tr>
              <tr>
                <td><b>مسمّى العربية:</b> <span>{m.vehicleLabel || ''}</span></td>
                <td><b>رقم العربية:</b> <span>{m.vehicleNo || ''}</span></td>
                <td><b>رقم المقطورة:</b> <span>{m.trailerNo || ''}</span></td>
              </tr>
              {m.note && (
                <tr><td colSpan={3}><b>ملاحظات:</b> <span>{m.note}</span></td></tr>
              )}
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
