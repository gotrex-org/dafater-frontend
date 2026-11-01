'use client';

import { useEffect, useRef, useState } from 'react';
import { EGP, fmtDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { downloadElementAsPdf } from '@/lib/pdf';
import { Spinner } from '@/components/common';
import { useManifest, useDeleteManifest } from '../hooks';
import { ManifestEditor } from './ManifestEditor';
import { CustomsTab, DriverTab, InvoiceTab, type LinkTab } from './ManifestLinkTabs';
import type { Manifest } from '../dtos';

const DOTS = '..........................';
// full A4 at 96dpi (210mm × 297mm) — the sheet is sized to fill the whole page
const PAGE_W = 794;
const PAGE_H = 1123;

/**
 * كشف العربية بتابات السلسلة: العربية · السائق · الفاتورة · الجمارك.
 * تاب العربية هو الكشف نفسه بشكله، والباقي سجلات مربوطة تتعدّل من مكانها أو
 * تتربط لو مش موجودة.
 */
export function ManifestPrint({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: m, isLoading } = useManifest(id);
  const [tab, setTab] = useState<LinkTab>('vehicle');

  if (isLoading || !m) return <Spinner />;
  const backToVehicle = () => setTab('vehicle');

  return (
    <>
      <LinkTabsNav m={m} tab={tab} onTab={setTab} />
      {tab === 'vehicle' && <VehicleSheet id={id} onClose={onClose} />}
      {tab === 'driver' && <DriverTab m={m} onBack={backToVehicle} />}
      {tab === 'invoice' && <InvoiceTab m={m} onBack={backToVehicle} />}
      {tab === 'customs' && <CustomsTab m={m} />}
    </>
  );
}

function LinkTabsNav({ m, tab, onTab }: { m: Manifest; tab: LinkTab; onTab: (t: LinkTab) => void }) {
  const ours = m.vehicleSource === 'OURS';
  const trip = m.driverTrips?.find((t) => t.uid);
  // البادچ جنب كل تاب: اسم/رقم المربوط، أو «غير مربوط» بلون مميز
  const items: { key: LinkTab; label: string; badge: string; linked: boolean }[] = [
    { key: 'vehicle', label: 'العربية', badge: m.no, linked: true },
    { key: 'driver', label: 'السائق', badge: !ours ? 'مكتب شحن' : trip ? trip.driverName || '—' : 'غير مربوط', linked: !ours || !!trip },
    {
      key: 'invoice', label: 'الفاتورة',
      badge: m.invoice ? m.invoice.no : m.deal ? `بيع خارجي ${m.deal.no}` : 'غير مربوطة',
      linked: !!(m.invoice || m.deal),
    },
    {
      key: 'customs', label: 'الجمارك',
      badge: !ours ? 'مكتب شحن' : m.clearance?.total ? EGP(m.clearance.total) : 'غير مربوطة',
      linked: !ours || !!m.clearance?.total,
    },
  ];
  return (
    <nav className="tabs no-print" style={{ marginBottom: 12 }}>
      {items.map((it) => (
        <button
          key={it.key}
          className={tab === it.key ? 'active' : ''}
          onClick={() => onTab(it.key)}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {it.label}{' '}
          <span className={`pill${it.linked ? '' : ' mt-status st-unlinked'}`} style={{ fontSize: 11 }}>{it.badge}</span>
        </button>
      ))}
    </nav>
  );
}

function VehicleSheet({ id, onClose }: { id: string; onClose: () => void }) {
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
  const trip = m.driverTrips?.find((t) => t.uid);

  // كشف خارج من مكتب شحن — اسم المكتب لازم يتكتب على الورقة.
  const fromOffice = m.vehicleSource === 'CLIENT_OFFICE';

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

      {!trip && m.vehicleSource === 'OURS' && (
        <div className="no-print" style={{ fontSize: 13, marginBottom: 10, color: 'var(--debit)' }}>
          هذا الكشف غير مربوط برحلة سائق. اربطه من تاب السائق.
        </div>
      )}

      <div className="print-scale" ref={outerRef}>
        {/* الديزاين القديم (app_4.html): ترويسة اسم الشركة + العنوان ورقم الكشف،
            بيانات الكشف حقل تحت حقل، جدول الأصناف (م / الاصناف / العدد)، والإقرار.
            كشف الاستلام في بوابة العميل بيستخدم mf-old من غير mf-plain، فبياناته
            لسه بالشكل الأفقي (٣ خانات في السطر). */}
        <div className="card print-sheet mf-old mf-plain" ref={innerRef}>
          <div className="pr-head">
            <div className="co">أبو شامة</div>
            <div className="ttl"><b>كشف استلام بضاعة</b><br />رقم: {m.no}</div>
          </div>

          {/* كل حقل في سطر لوحده: التاريخ، العميل، بيانات السائق (من رحلته
              وسجل السائقين — الـ API بيعبّيها)، بيانات العربية، الملاحظات.
              الناولون والتكاليف مش في الكشف المطبوع. */}
          <table className="pr pr-info">
            <tbody>
              <tr><td><b>التاريخ:</b> <span>{fmtDate(m.date)}</span></td></tr>
              <tr><td><b>اسم العميل:</b> <span>{m.clientName || ''}</span></td></tr>
              {fromOffice && (
                <tr><td><b>مكتب الشحن:</b> <span>{m.shippingOffice || ''}</span></td></tr>
              )}
              <tr><td><b>اسم السائق:</b> <span>{m.driverName || ''}</span></td></tr>
              <tr><td><b>الرقم القومي:</b> <span>{m.driverNID || ''}</span></td></tr>
              <tr><td><b>رقم التليفون:</b> <span>{m.driverPhone || ''}</span></td></tr>
              <tr><td><b>رقم العربية:</b> <span>{m.vehicleNo || ''}</span></td></tr>
              {m.trailerNo && (
                <tr><td><b>رقم المقطورة:</b> <span>{m.trailerNo}</span></td></tr>
              )}
              <tr><td><b>مسمّى العربية:</b> <span>{m.vehicleLabel || ''}</span></td></tr>
              {m.note && (
                <tr><td><b>ملاحظات:</b> <span>{m.note}</span></td></tr>
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
                  <tr><td colSpan={3} className="empty">لا توجد أصناف في الكشف</td></tr>
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
              أقر أنا / <b>{m.driverName || DOTS}</b>
              {' '}رقم قومي / <b>{m.driverNID || DOTS}</b>
              {' '}سائق العربية رقم / <b>{m.vehicleNo || DOTS}</b> باستلام البضاعة المذكورة أعلاه،
              وأتعهد بالحفاظ على البضاعة المستلمة في حالتها الجيدة، والالتزام بتوصيلها إلى
              الجهة المحددة، كما أتعهد برد قيمة أي عجز أو تلف أو فقد يحدث بها لأي سبب يرجع لي.
            </p>
            <div className="pr-sign">
              <span>اسم السائق: <b>{m.driverName || DOTS}</b></span>
              <span>التليفون: <b>{m.driverPhone || DOTS}</b></span>
              <span>التوقيع: {DOTS}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
