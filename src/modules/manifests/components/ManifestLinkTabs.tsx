'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EGP, fmtDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { MoneyInput, Spinner } from '@/components/common';
import { RecordOpener } from '../../records/RecordOpener';
import { InvoiceDetailById } from '../../invoices/components/InvoiceDetail';
import { DealDetailById } from '../../deals/components/DealsView';
import { useInvoices } from '../../invoices/hooks';
import { useDeals } from '../../deals/hooks';
import { DriverTripDetailById } from '../../driver-trips/components/DriverTripDetail';
import { DriverTripEditor } from '../../driver-trips/components/DriverTripEditor';
import { useDriverTrip, useDriverTrips, useLinkTripInvoice, useUpdateDriverTrip } from '../../driver-trips/hooks';
import { useDeleteClearanceMovement, useUpdateClearanceMovement } from '../../clearance/hooks';
import { useUpdateManifest, useVehicleShipping } from '../hooks';
import { CustomsForm } from './ShippingCosts';
import type { Manifest } from '../dtos';

/**
 * تابات السلسلة داخل كشف العربية: السائق · الفاتورة · الجمارك.
 * كل تاب بيعرض شاشة السجل المربوط نفسها (بتعديلها)، ولو مفيش ربط بيعرض اختيار
 * الربط. الربط بيتسجّل على السجل الأصلي، فبيظهر في كشف السائق والفاتورة وحساب
 * مكتب التخليص من غير أي نسخ.
 */

export type LinkTab = 'vehicle' | 'driver' | 'invoice' | 'customs';

const tripOf = (m: Manifest) => m.driverTrips?.find((t) => t.uid);

/** عربية مكتب شحن تابع للعميل — مالهاش رحلة سائق ولا جمارك عندنا. */
function OfficeNote({ what }: { what: string }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <b>عربية مكتب شحن</b>
      <div className="muted" style={{ marginTop: 4 }}>هذه العربية من مكتب شحن تابع للعميل، لذلك لا يوجد لها {what}.</div>
    </div>
  );
}

// ─── السائق ───────────────────────────────────────────────────────────────────

export function DriverTab({ m, onBack }: { m: Manifest; onBack: () => void }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const trip = tripOf(m);
  const [creating, setCreating] = useState(false);
  const { data: trips, isLoading } = useDriverTrips();
  const updateTrip = useUpdateDriverTrip();
  const linkInvoice = useLinkTripInvoice();
  const [err, setErr] = useState('');

  if (m.vehicleSource !== 'OURS') return <OfficeNote what="رحلة في كشف السائقين" />;
  if (trip) return <DriverTripDetailById uid={trip.uid!} onBack={onBack} />;

  const refresh = () => qc.invalidateQueries({ queryKey: ['manifests'] });

  if (creating) {
    return (
      <DriverTripEditor
        manifest={m}
        onSaved={(t) => {
          // الرحلة الجديدة تاخد فاتورة الكشف كمان، عشان الناولون المحصّل يتقرا منها
          if (m.invoice) linkInvoice.mutate({ id: t.id, invoiceId: m.invoice.id });
          else if (m.deal) linkInvoice.mutate({ id: t.id, invoiceId: m.deal.id, type: 'deal' });
          setCreating(false);
          refresh();
        }}
        onSkip={() => setCreating(false)}
      />
    );
  }

  // رحلات مسجّلة من غير كشف — ممكن تتربط بالكشف ده. اللي لنفس العميل الأول.
  const free = (trips ?? [])
    .filter((t) => !t.manifestId && !t.manifest)
    .sort((a, b) => Number(b.clientName === m.clientName) - Number(a.clientName === m.clientName));

  const link = (id: string) => {
    setErr('');
    updateTrip.mutate(
      { id, dto: { manifestId: m.id } },
      {
        onSuccess: () => {
          if (m.invoice) linkInvoice.mutate({ id, invoiceId: m.invoice.id });
          else if (m.deal) linkInvoice.mutate({ id, invoiceId: m.deal.id, type: 'deal' });
          refresh();
        },
        onError: (e: any) => setErr(e?.message || 'تعذر الربط'),
      },
    );
  };

  return (
    <div className="card" style={{ padding: 18, display: 'grid', gap: 12 }}>
      <div>
        <b style={{ fontSize: 15 }}>لا توجد رحلة سائق مربوطة بهذه العربية</b>
        <div className="muted" style={{ fontSize: 13 }}>سجّل رحلة جديدة ببيانات الكشف، أو اربط رحلة مسجّلة من قبل.</div>
      </div>
      {can('drivers.create') && (
        <div><button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ رحلة جديدة لهذه العربية</button></div>
      )}
      <div style={{ fontWeight: 700, fontSize: 13 }}>رحلات غير مربوطة بكشف</div>
      {isLoading ? <Spinner /> : free.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>لا توجد رحلات غير مربوطة.</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>السائق</th><th>العميل</th><th>العربية</th><th>تاريخ الخروج</th><th className="num">الناولون</th><th /></tr></thead>
            <tbody>
              {free.slice(0, 30).map((t) => (
                <tr key={t.id}>
                  <td><b>{t.driverName}</b></td>
                  <td>{t.clientName}</td>
                  <td className="muted">{[t.vehicleLabel, t.vehicleNo].filter(Boolean).join(' — ') || '—'}</td>
                  <td className="muted">{fmtDate(t.departureDate)}</td>
                  <td className="num">{EGP(t.agreedFreight)}</td>
                  <td><button className="btn btn-ghost btn-sm" disabled={updateTrip.isPending} onClick={() => link(t.id)}>ربط بهذه العربية</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {err && <div className="err-text">{err}</div>}
    </div>
  );
}

// ─── الفاتورة ─────────────────────────────────────────────────────────────────

export function InvoiceTab({ m, onBack }: { m: Manifest; onBack: () => void }) {
  const { can } = useAuth();
  const updateManifest = useUpdateManifest();
  const linkInvoice = useLinkTripInvoice();
  const trip = tripOf(m);
  const { data: tripData } = useDriverTrip(trip?.uid ?? '');
  const client = m.clientName.trim();
  const linked = !!(m.invoice || m.deal);
  const { data: invoicesPage, isLoading: li } = useInvoices(!linked && client ? { search: client, pageSize: 200 } : { pageSize: 1 });
  const { data: dealsPage, isLoading: ld } = useDeals(!linked && client ? { search: client, pageSize: 200 } : { pageSize: 1 });
  const [err, setErr] = useState('');

  if (m.invoice || m.deal) {
    const label = m.invoice ? `الفاتورة ${m.invoice.no}` : `البيع الخارجي ${m.deal!.no}`;
    // فك الربط يمسح الربط من الكشف فقط؛ الفاتورة نفسها ورحلة السائق تبقى كما هي
    const unlink = () => {
      if (!window.confirm(`فك ربط ${label} بكشف العربية ${m.no}؟`)) return;
      setErr('');
      updateManifest.mutate(
        { id: m.id, dto: { invoiceId: '', dealId: '' } },
        { onError: (e: any) => setErr(e?.message || 'تعذر فك الربط') },
      );
    };
    return (
      <>
        {can('manifests.edit') && (
          <div className="toolbar no-print">
            <span className="muted" style={{ fontSize: 13 }}>{label} مربوطة بهذا الكشف</span>
            <button className="btn btn-danger btn-sm sp" disabled={updateManifest.isPending} onClick={unlink}>
              {updateManifest.isPending ? '…' : 'فك ربط الفاتورة بالكشف'}
            </button>
          </div>
        )}
        {err && <div className="err-text">{err}</div>}
        {m.invoice
          ? <InvoiceDetailById uid={m.invoice.id} onBack={onBack} />
          : <DealDetailById uid={m.deal!.id} onBack={onBack} />}
      </>
    );
  }

  const invoices = (invoicesPage?.data ?? []).filter((i) => i.party?.name === client);
  const deals = (dealsPage?.data ?? []).filter((d) => d.client?.name === client);

  const link = (id: string, type: 'invoice' | 'deal') => {
    setErr('');
    updateManifest.mutate(
      { id: m.id, dto: type === 'deal' ? { dealId: id, invoiceId: '' } : { invoiceId: id, dealId: '' } },
      {
        onSuccess: () => {
          // رحلة السائق تتربط بنفس المستند لو لسه مش مربوطة بحاجة
          if (trip?.uid && tripData && !tripData.invoice && !tripData.deal) {
            linkInvoice.mutate({ id: trip.uid, invoiceId: id, type });
          }
        },
        onError: (e: any) => setErr(e?.message || 'تعذر الربط'),
      },
    );
  };
  const canLink = can('manifests.edit');

  return (
    <div className="card" style={{ padding: 18, display: 'grid', gap: 12 }}>
      <div>
        <b style={{ fontSize: 15 }}>لا توجد فاتورة مربوطة بهذه العربية</b>
        <div className="muted" style={{ fontSize: 13 }}>
          اختر فاتورة أو عملية بيع خارجي للعميل {client || '—'}. الربط يظهر في الفاتورة وفي رحلة السائق.
        </div>
      </div>
      {li || ld ? <Spinner /> : invoices.length + deals.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>لا توجد فواتير لهذا العميل.</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>المستند</th><th>التاريخ</th><th /></tr></thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={`i${i.id}`}>
                  <td><b>فاتورة {i.kind === 'SALE' ? 'بيع' : 'شراء'} {i.no}</b></td>
                  <td className="muted">{fmtDate(i.date)}</td>
                  <td>{canLink && <button className="btn btn-ghost btn-sm" disabled={updateManifest.isPending} onClick={() => link(i.id, 'invoice')}>ربط بهذه العربية</button>}</td>
                </tr>
              ))}
              {deals.map((d) => (
                <tr key={`d${d.id}`}>
                  <td><b>بيع خارجي {d.no}</b></td>
                  <td className="muted">{fmtDate(d.date)}</td>
                  <td>{canLink && <button className="btn btn-ghost btn-sm" disabled={updateManifest.isPending} onClick={() => link(d.id, 'deal')}>ربط بهذه العربية</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {err && <div className="err-text">{err}</div>}
    </div>
  );
}

// ─── الجمارك ──────────────────────────────────────────────────────────────────

function CustomsRow({ l, canEdit, canDelete }: {
  l: { id: string; date: string; amount: number; office: { id: string; name: string } | null; note: string | null };
  canEdit: boolean;
  canDelete: boolean;
}) {
  const update = useUpdateClearanceMovement();
  const del = useDeleteClearanceMovement();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(l.date.slice(0, 10));
  const [amount, setAmount] = useState(String(l.amount));
  const [note, setNote] = useState(l.note ?? '');
  const [err, setErr] = useState('');

  if (editing) {
    const save = () => {
      setErr('');
      if (!Number(amount)) return setErr('اكتب المبلغ');
      update.mutate(
        { id: l.id, dto: { date, amount: Number(amount), note: note.trim() } },
        { onSuccess: () => setEditing(false), onError: (e: any) => setErr(e?.message || 'تعذر الحفظ') },
      );
    };
    return (
      <tr>
        <td><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></td>
        <td>{l.office?.name ?? '—'}</td>
        <td><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="البيان" /></td>
        <td><MoneyInput value={amount} onChange={setAmount} style={{ width: 110 }} /></td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={update.isPending}>{update.isPending ? '…' : 'حفظ'}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>إلغاء</button>
          {err && <div className="err-text">{err}</div>}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="muted">{fmtDate(l.date)}</td>
      <td>{l.office?.name ?? '—'}</td>
      <td className="muted">{l.note ?? ''}</td>
      <td className="num">{EGP(l.amount)}</td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>تعديل</button>}
        {canDelete && (
          <button
            className="btn btn-ghost btn-sm" style={{ color: 'var(--debit)' }} disabled={del.isPending}
            onClick={() => { if (window.confirm('حذف هذا المبلغ من العربية ومن حساب مكتب التخليص؟')) del.mutate(l.id); }}
          >حذف</button>
        )}
      </td>
    </tr>
  );
}

export function CustomsTab({ m }: { m: Manifest }) {
  const { can } = useAuth();
  const { data: s, isLoading } = useVehicleShipping(m.id);
  const [adding, setAdding] = useState(false);
  const [office, setOffice] = useState<string | null>(null);

  if (m.vehicleSource !== 'OURS') return <OfficeNote what="جمارك" />;
  if (office) return <RecordOpener entity="parties" uid={office} onClose={() => setOffice(null)} />;
  if (isLoading || !s) return <Spinner />;

  const lines = s.customs.lines;
  const canAdd = can('clearance.expense') || can('manifests.shipping');
  const offices = Array.from(new Map(lines.filter((l) => l.office).map((l) => [l.office!.id, l.office!])).values());

  return (
    <div className="card" style={{ padding: 18, display: 'grid', gap: 12 }}>
      {lines.length === 0 ? (
        <div>
          <b style={{ fontSize: 15 }}>لا توجد جمارك مربوطة بهذه العربية</b>
          <div className="muted" style={{ fontSize: 13 }}>اختر مكتب التخليص واكتب المبلغ. يُرحَّل المبلغ على حساب المكتب ويظهر في كشفه.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <b style={{ fontSize: 15 }}>جمارك العربية</b>
            {offices.map((o) => (
              <button key={o.id} className="btn btn-ghost btn-sm" onClick={() => setOffice(o.id)}>كشف {o.name} ←</button>
            ))}
          </div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>التاريخ</th><th>مكتب التخليص</th><th>البيان</th><th className="num">المبلغ</th><th /></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <CustomsRow key={l.id} l={l} canEdit={can('clearance.edit')} canDelete={can('clearance.delete')} />
                ))}
                <tr className="mf-total">
                  <td colSpan={3}><b>إجمالي جمارك العربية</b></td>
                  <td className="num"><b>{EGP(s.customs.total)}</b></td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
      {canAdd && (
        adding || lines.length === 0
          ? <CustomsForm manifestId={m.id} onDone={() => setAdding(false)} />
          : <div><button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>+ جمارك على العربية</button></div>
      )}
    </div>
  );
}
