'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, EGP, money } from '@/lib/format';
import { downloadElementAsPdf, printElementOnePage } from '@/lib/pdf';

// أول يوم في الشهر الحالي (توقيت محلي) — الكشف يبدأ منه افتراضيًا
function portalStartOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
import { ProductCombobox } from '../products/components/ProductCombobox';
import { InvoiceSheetBody, InvoiceSheetPayments } from '../invoices/components/InvoiceSheet';
import type { AuthUser, Paginated } from '@/lib/types';

// ─── types ────────────────────────────────────────────────────────────────────

// Note: the API's uid-serializer interceptor renames the DB's `uid` column to
// `id` on every response, so /products/catalog rows arrive shaped `{id, ...}`.
interface CatalogProduct { id: string; name: string; unit?: string | null }

interface MyOrderItem { id?: string; name: string; qty: number; received?: number }
interface MyOrder {
  id: string;
  date: string;
  note?: string | null;
  status: 'NEW' | 'DONE';
  items: MyOrderItem[];
}

interface ManifestItem { id?: string; name: string; qty: number }
interface MyManifest {
  id: string; uid: string; no: string; date: string; clientName: string;
  vehicleNo?: string | null; vehicleLabel?: string | null; trailerNo?: string | null; driverName?: string | null;
  driverPhone?: string | null; driverNID?: string | null; note?: string | null;
  items: ManifestItem[];
  driverTrips?: { arrivalDate: string | null }[];
}

interface LedgerRow {
  id: string; date: string; type: string; note?: string | null;
  debit: number; credit: number; balance: number;
  /** ترقيم مستندات العميل (فاتورة ١، ٢، ٣…) — مش الرقم الداخلي */
  docNo?: number | null;
  invoiceUid?: string | null; dealUid?: string | null;
  invoiceItems?: { name: string; qty: number; price: number }[] | null;
}

interface LedgerResponse { opening: number; balance: number; rows: LedgerRow[] }

// فاتورة العميل بشكل الشيت — GET /invoices/my/:uid
interface MyInvoice {
  date: string;
  currency: 'EGP' | 'USD';
  items: { name: string; qty: number; price: number }[];
  /** إجمالي الأصناف بعد الخصم */
  itemsTotal: number;
  discount: number;
  /** الحساب القديم: الباقي من الفاتورة اللي قبلها */
  previousBalance: number;
  /** رسوم نقل النقدية المتسجّلة مع الاستلامات في نفس الفترة */
  cashTransfer: number;
  /** مصاريف الفترة — من الفاتورة دي لحد اللي بعدها */
  expensesTotal: number;
  payments: { id: string; date: string; amount: number; note: string }[];
  paymentsTotal: number;
  /** الباقي عليه بعد الفاتورة واستلاماتها */
  remaining: number;
}

// ─── hooks ────────────────────────────────────────────────────────────────────

function useProductCatalog() {
  return useQuery<CatalogProduct[]>({
    queryKey: ['products-catalog'],
    queryFn: () => api.get('/products/catalog'),
    staleTime: 5 * 60_000,
  });
}

function useMyOrders() {
  return useQuery<Paginated<MyOrder>>({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/orders/my?pageSize=100'),
    refetchInterval: 30_000,
  });
}

function useMyLedger(params: { from?: string; to?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const q = qs.toString();
  return useQuery<LedgerResponse>({
    queryKey: ['my-ledger', params.from, params.to],
    queryFn: () => api.get(`/parties/my/ledger${q ? '?' + q : ''}`),
  });
}

// ---- تابات «فاتورة N / استلامات N» في البوابة ----

interface MyInvoiceRow { id: string; no: string; date: string; currency: 'EGP' | 'USD' }

interface MyManifestTab {
  id: string;
  no: string;
  date: string;
  clientName: string;
  vehicleLabel?: string | null;
  vehicleNo?: string | null;
  trailerNo?: string | null;
  driverName?: string | null;
  /** وصلت / في الطريق — منها لون التاب والكشف */
  status: 'arrived' | 'pending' | 'none';
  note?: string | null;
  items: { id: string; name: string; qty: number; price: number | null; total: number | null }[];
  itemsTotal: number;
  expenses: { id: string; date: string; note: string | null; category: string | null; amount: number }[];
  expensesTotal: number;
}

const MT_STATUS_LABEL: Record<MyManifestTab['status'], string> = {
  arrived: 'وصلت ✓',
  pending: 'في الطريق',
  none: 'مافيش رحلة متسجّلة',
};

/** حالة العربية من رحلات السائق — نفس قاعدة السيستم الداخلي بالظبط. */
function manifestTripStatus(trips?: { arrivalDate: string | null }[]): MyManifestTab['status'] {
  if (!trips?.length) return 'none';
  return trips.some((t) => t.arrivalDate) ? 'arrived' : 'pending';
}

/** خلفية سطر الكشف حسب حالته — نفس ألوان قايمة الكشوفات الداخلية. */
const MT_ROW_TINT: Record<MyManifestTab['status'], React.CSSProperties> = {
  arrived: { background: 'rgba(178,58,46,0.12)' },
  pending: { background: 'rgba(15,110,92,0.12)' },
  none: {},
};

function useMyInvoiceList() {
  return useQuery<MyInvoiceRow[]>({
    queryKey: ['my-invoices'],
    queryFn: () => api.get('/invoices/my'),
  });
}

function useMyManifestTabs(uid: string | null) {
  return useQuery<{ currency: 'EGP' | 'USD'; tabs: MyManifestTab[] }>({
    queryKey: ['my-manifest-tabs', uid],
    queryFn: () => api.get(`/invoices/my/${uid}/manifest-tabs`),
    enabled: !!uid,
  });
}

function useMyInvoice(uid: string | null) {
  return useQuery<MyInvoice>({
    queryKey: ['my-invoice', uid],
    queryFn: () => api.get(`/invoices/my/${uid}`),
    enabled: !!uid,
  });
}

function useMyLedgerBalance() {
  return useQuery<LedgerResponse>({
    queryKey: ['my-ledger-balance'],
    queryFn: () => api.get('/parties/my/ledger'),
    staleTime: 60_000,
  });
}

function useMyManifests() {
  return useQuery<MyManifest[]>({
    queryKey: ['my-manifests'],
    queryFn: () => api.get('/manifests/my'),
  });
}

function useSubmitOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { note?: string; items: { name: string; qty: number }[] }) =>
      api.post<MyOrder>('/orders/my', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-orders'] }),
  });
}

// ─── order form ───────────────────────────────────────────────────────────────

let _lineKey = 0;
interface Line { _key: number; productName: string; qty: string }
const blank = (): Line => ({ _key: _lineKey++, productName: '', qty: '' });

function OrderForm({ products }: { products: CatalogProduct[] }) {
  const submit = useSubmitOrder();
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const save = () => {
    setErr(''); setMsg('');
    const items = lines
      .filter((l) => l.productName.trim() && Number(l.qty) > 0)
      .map((l) => ({ name: l.productName.trim(), qty: Number(l.qty) }));
    if (!items.length) return setErr('أضف صنفًا واحدًا على الأقل');
    submit.mutate(
      { note: note.trim() || undefined, items },
      {
        onSuccess: () => { setMsg('تم إرسال الطلبية ✓'); setLines([blank()]); setNote(''); },
        onError: (e: any) => setErr(e.message),
      },
    );
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 15, fontWeight: 700 }}>طلبية جديدة</h3>
      <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
        {lines.map((l, i) => (
          <div key={l._key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <ProductCombobox
                products={products}
                value={l.productName}
                onChange={(v) => setLine(i, { productName: v })}
                freeText
                allowCreate={false}
                placeholder="اكتب اسم الصنف…"
              />
            </div>
            <input type="number" min="1" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} placeholder="الكمية" style={{ width: 90 }} />
            {lines.length > 1 && (
              <button className="btn btn-danger btn-sm" onClick={() => setLines((ls) => ls.filter((x) => x._key !== l._key))}>×</button>
            )}
          </div>
        ))}
      </div>
      <div className="toolbar" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setLines((ls) => [...ls, blank()])}>+ إضافة صنف</button>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظات (اختياري)" style={{ width: '100%', marginBottom: 12 }} />
      {err && <div className="err-text" style={{ marginBottom: 8 }}>{err}</div>}
      {msg && <div style={{ color: 'var(--credit)', fontWeight: 700, marginBottom: 8 }}>{msg}</div>}
      <button className="btn btn-primary" onClick={save} disabled={submit.isPending}>
        {submit.isPending ? '...' : 'إرسال الطلبية'}
      </button>
    </div>
  );
}

// ─── order card (read-only) ───────────────────────────────────────────────────

function OrderCard({ o }: { o: MyOrder }) {
  const isDone = o.status === 'DONE';
  const hasUpdates = o.items.some((it) => (it.received ?? 0) > 0);
  return (
    <div className="card" style={{ padding: 14, borderRight: `3px solid ${isDone ? 'var(--credit)' : 'var(--primary)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtDateTime(o.date)}</span>
        <span className="pill" style={{
          background: isDone ? 'var(--credit-bg)' : 'var(--primary-bg, #fff3e0)',
          color: isDone ? 'var(--credit)' : 'var(--primary)',
          fontWeight: 700,
        }}>
          {isDone ? 'تم التنفيذ ✓' : 'قيد المراجعة'}
        </span>
      </div>
      {o.note && <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--muted)' }}>{o.note}</p>}
      <div className="tbl-wrap" style={{ marginBottom: 0 }}>
        <table>
          <thead>
            <tr>
              <th>الصنف</th>
              <th style={{ width: 70 }}>المطلوب</th>
              {hasUpdates && <th style={{ width: 70 }}>الوارد</th>}
              {hasUpdates && <th style={{ width: 70 }}>المتبقّي</th>}
            </tr>
          </thead>
          <tbody>
            {o.items.map((it, i) => {
              const received = it.received ?? 0;
              const remaining = Math.max(0, it.qty - received);
              return (
                <tr key={it.id ?? i}>
                  <td>{it.name}</td>
                  <td className="num">{it.qty}</td>
                  {hasUpdates && <td className="num cre">{received}</td>}
                  {hasUpdates && <td className={`num ${remaining === 0 ? 'cre' : 'deb'}`}>{remaining}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── orders tab ───────────────────────────────────────────────────────────────

function OrdersTab({ products }: { products: CatalogProduct[] }) {
  const { data, isLoading } = useMyOrders();
  const [showDone, setShowDone] = useState(false);

  const all = data?.data ?? [];
  const active = all.filter((o) => o.status === 'NEW');
  const done = all.filter((o) => o.status === 'DONE');

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <OrderForm products={products} />

      <div>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>
          الطلبيات النشطة
          {active.length > 0 && <span className="pill" style={{ marginInlineStart: 8, background: 'var(--primary)', color: '#fff' }}>{active.length}</span>}
        </h3>
        {isLoading && <div className="empty">جاري التحميل…</div>}
        {!isLoading && active.length === 0 && <div className="empty muted" style={{ fontSize: 13 }}>لا توجد طلبيات نشطة حالياً</div>}
        <div style={{ display: 'grid', gap: 10 }}>
          {active.map((o) => <OrderCard key={o.id} o={o} />)}
        </div>
      </div>

      {done.length > 0 && (
        <div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowDone((s) => !s)}
            style={{ marginBottom: 10, fontWeight: 700 }}
          >
            {showDone ? '▾' : '▸'} الطلبيات المنتهية ({done.length})
          </button>
          {showDone && (
            <div style={{ display: 'grid', gap: 10 }}>
              {done.map((o) => <OrderCard key={o.id} o={o} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ledger tab ───────────────────────────────────────────────────────────────

type LedgerKind = 'all' | 'invoices' | 'collect';

// فاتورة العميل بشكل الشيت: الأصناف على اليمين، ملخّص جنبها، والاستلامات تحتها.
// مبنية للموبايل الأول — على الشاشة الصغيرة الجداول بتبقى كروت (شوف .portal-sheet في globals.css)،
// وفي الـ PDF/الطباعة بترجع جداول لأن captureSheet بيثبّت العرض ويضيف .pdf-capture.
function PortalInvoiceView({ uid, docNo, partyName, onBack }: {
  uid: string; docNo: number | null; partyName?: string; onBack: () => void;
}) {
  const { data, isLoading } = useMyInvoice(uid);
  const sheetRef = useRef<HTMLDivElement>(null);
  const title = `فاتورة${docNo ? ` ${docNo}` : ''}`;

  if (isLoading) return <div className="empty">جاري التحميل…</div>;
  if (!data) return (
    <>
      <div className="toolbar no-print"><button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع للكشف</button></div>
      <div className="empty">الفاتورة مش متاحة</div>
    </>
  );

  const m = (n: number) => money(n, data.currency);
  // اجمالي الفاتورة شامل الحساب القديم — زي عمود «الاجمالي» في الشيت.
  const sheetTotal = data.previousBalance + data.itemsTotal;
  // أي حركة تانية في نفس الفترة (مرتجع/خصم/مصروف) بتفضل في كشف الحساب — بتتعرض هنا
  // كسطر واحد بس عشان الورقة تقفل مع الرصيد.
  const other = data.remaining - (sheetTotal + data.cashTransfer - data.paymentsTotal);

  return (
    <>
      <div className="toolbar no-print" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع للكشف</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => sheetRef.current && downloadElementAsPdf(sheetRef.current, title)}>⬇ PDF</button>
        <button className="btn btn-primary btn-sm" onClick={() => sheetRef.current && printElementOnePage(sheetRef.current, title)}>🖨 طباعة</button>
      </div>

      <div ref={sheetRef} className="card print-sheet portal-sheet">
        <div className="mf-logo">أبو شامة</div>
        <div className="mf-head">
          <h2 style={{ fontSize: 18 }}>{title}</h2>
          <div className="mf-meta">
            {partyName && <span>{partyName}</span>}
            <span>التاريخ: <b>{fmtDate(data.date)}</b></span>
          </div>
        </div>

        <div className="sh-body">
          <div className="sh-items tbl-wrap">
            <table className="inv-tbl">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>العدد</th>
                  <th>الصنف</th>
                  <th style={{ width: 100 }}>السعر</th>
                  <th style={{ width: 120 }}>الاجمالي</th>
                </tr>
              </thead>
              <tbody>
                <tr className="sh-old">
                  <td colSpan={3}>حــــســـــاب قــــديــــم</td>
                  <td className="num">{m(data.previousBalance)}</td>
                </tr>
                {data.items.map((it, i) => (
                  <tr key={i}>
                    <td className="num" data-l="عدد">{it.qty}</td>
                    <td>{it.name}</td>
                    <td className="num" data-l="سعر">{m(it.price)}</td>
                    <td className="num">{m(it.qty * it.price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="mf-total">
                  <td colSpan={3}>{data.discount > 0 ? 'إجمالي الأصناف بعد الخصم' : 'إجمالي الأصناف'}</td>
                  <td className="num">{m(data.itemsTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <aside className="sh-side">
            <div className="sh-box">
              <div className="sh-box-l">اجمالي الفاتورة</div>
              <div className="sh-box-v num">{m(sheetTotal)}</div>
            </div>
            {data.cashTransfer !== 0 && (
              <div className="sh-box">
                <div className="sh-box-l">نقل نقدية</div>
                <div className="sh-box-v num">{m(data.cashTransfer)}</div>
              </div>
            )}
            <div className="sh-box">
              <div className="sh-box-l">استلامات</div>
              <div className="sh-box-v num">{m(data.paymentsTotal)}</div>
            </div>
            {Math.abs(other) > 0.005 && (
              <div className="sh-box">
                <div className="sh-box-l">حركات أخرى</div>
                <div className="sh-box-v num">{m(other)}</div>
              </div>
            )}
            <div className="sh-box sh-box-end">
              <div className="sh-box-l">{data.remaining <= 0 ? 'الباقي لك' : 'الباقي عليك'}</div>
              <div className="sh-box-v num">{m(Math.abs(data.remaining))}</div>
            </div>
          </aside>
        </div>

        {data.payments.length > 0 && (
          <div className="sh-pay tbl-wrap">
            <div className="sh-pay-title">الاستلامات بعد الفاتورة</div>
            <table className="pay-tbl">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>التاريخ</th>
                  <th>البيان</th>
                  <th style={{ width: 130 }}>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.date)}</td>
                    <td>{p.note}</td>
                    <td className="num">{m(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="mf-total">
                  <td colSpan={2}>الإجمالي</td>
                  <td className="num">{m(data.paymentsTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {Math.abs(other) > 0.005 && (
          <div className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
            «حركات أخرى» تفاصيلها في كشف الحساب.
          </div>
        )}
        <div className="mf-grow" />
      </div>
    </>
  );
}

function LedgerTab({ partyName }: { partyName?: string }) {
  // افتراضيًا من أول الشهر — قابل للتغيير من الفلتر
  const [from, setFrom] = useState(portalStartOfMonth());
  const [to, setTo] = useState('');
  const [kind, setKind] = useState<LedgerKind>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // الفاتورة بتتفتح صفحة كاملة بشكل الشيت؛ البيع الخارجي (صفقة) لسه بينفتح تحت السطر.
  const [openInvoice, setOpenInvoice] = useState<{ uid: string; docNo: number | null } | null>(null);
  const { data, isLoading } = useMyLedger({ from: from || undefined, to: to || undefined });
  const sheetRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didScroll = useRef(false);

  // أول ما البيانات تحمّل، انزل لآخر الكشف (أحدث معاملة) — والمستخدم يسكرول فوق للأقدم
  useEffect(() => {
    if (data && !didScroll.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ block: 'end' });
      didScroll.current = true;
    }
  }, [data]);

  const toggle = (id: string) =>
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (openInvoice) {
    return (
      <PortalInvoiceView
        uid={openInvoice.uid}
        docNo={openInvoice.docNo}
        partyName={partyName}
        onBack={() => setOpenInvoice(null)}
      />
    );
  }

  if (isLoading) return <div className="empty">جاري التحميل…</div>;
  if (!data) return null;

  // الباك بيرجّع الأحدث فوق — نعكسها لترتيب زمني صح (شامل ترتيب نفس اليوم)
  const visibleRows = (data.rows ?? [])
    .filter((r) => {
      if (kind === 'invoices') return !!(r.invoiceUid || r.dealUid);
      if (kind === 'collect') return !r.invoiceUid && !r.dealUid;
      return true;
    })
    .reverse();

  // الرصيد الافتتاحي بيتحسب جوّه الإجمالي تحت — عشان الصافي يطلع "له/عليه" صح
  // حتى لو العميل فلتر على الفواتير بس أو اختار "كل الفترة".
  const opening = data.opening || 0;
  const totalDebit = visibleRows.reduce((s, r) => s + (r.debit || 0), 0) + (opening > 0 ? opening : 0);
  const totalCredit = visibleRows.reduce((s, r) => s + (r.credit || 0), 0) + (opening < 0 ? -opening : 0);
  const net = totalDebit - totalCredit;
  const cols = kind === 'all' ? 5 : 4;

  // الفواتير بقت بتتفتح صفحة لوحدها — الكشف السريع ده بقى للصفقات (البيع الخارجي) بس
  const detailRowIds = visibleRows.filter((r) => r.invoiceItems?.length && !r.invoiceUid).map((r) => r.id);
  const allExpanded = detailRowIds.length > 0 && detailRowIds.every((id) => expanded.has(id));
  const toggleAllDetails = () => setExpanded(allExpanded ? new Set() : new Set(detailRowIds));

  return (
    <>
      <div className="toolbar no-print" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 13 }}>من</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        <span className="muted" style={{ fontSize: 13 }}>إلى</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        {(from || to) && <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); }}>كل الفترة</button>}
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => sheetRef.current && downloadElementAsPdf(sheetRef.current, `كشف-حساب${partyName ? '-' + partyName : ''}`)}>⬇ تحميل PDF</button>
        <button className="btn btn-primary btn-sm" onClick={() => sheetRef.current && printElementOnePage(sheetRef.current, `كشف-حساب${partyName ? '-' + partyName : ''}`)}>🖨 طباعة</button>
      </div>

      <div className="toolbar no-print" style={{ marginBottom: 12 }}>
        {([['all', 'كشف الكل'], ['invoices', 'الفواتير فقط'], ['collect', 'التحصيل فقط']] as [LedgerKind, string][]).map(([k, label]) => (
          <button key={k} className={`btn btn-sm ${kind === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setKind(k)}>{label}</button>
        ))}
        {detailRowIds.length > 0 && (
          <button className="btn btn-ghost btn-sm sp" onClick={toggleAllDetails}>
            {allExpanded ? '▾ إخفاء التفاصيل' : '▸ كشف كل التفاصيل'}
          </button>
        )}
      </div>

      {/* portal-sheet: على الموبايل الصفوف بتتحوّل كروت بدل جدول — والـ PDF/الطباعة
          بيرجّعوا شكل الجدول لأن captureSheet بيثبّت العرض على 794px ويضيف .pdf-capture */}
      <div ref={sheetRef} className="card print-sheet ledger-sheet portal-sheet">
        <div className="mf-logo">أبو شامة</div>
        <div className="mf-head"><h2>كشف حساب{partyName ? ` — ${partyName}` : ''}</h2></div>
        <div className="muted" style={{ margin: '8px 4px' }}>
          {from || to
            ? <>الفترة: {from ? fmtDate(from) : '…'} ← {to ? fmtDate(to) : '…'}</>
            : 'الفترة: كل الحركات'}
        </div>

        <div className="tbl-wrap mf-grow">
          <table className="pl-tbl">
            <thead>
              <tr>
                <th>التاريخ</th><th>البيان</th><th>عليه</th><th>له</th>
                {kind === 'all' && <th>الرصيد</th>}
              </tr>
            </thead>
            <tbody>
              {opening !== 0 && (
                <tr className="pl-row">
                  <td className="muted pl-date" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>—</td>
                  <td className="pl-note" style={{ fontWeight: 700 }}>رصيد افتتاحي</td>
                  <td className="num deb pl-deb" data-l="عليه">{opening > 0 ? EGP(opening) : ''}</td>
                  <td className="num cre pl-cre" data-l="له">{opening < 0 ? EGP(-opening) : ''}</td>
                  {kind === 'all' && (
                    <td className="num pl-bal" style={{ fontWeight: 700, color: opening <= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                      {EGP(Math.abs(opening))} {opening <= 0 ? 'له' : 'عليه'}
                    </td>
                  )}
                </tr>
              )}
              {visibleRows.map((r) => {
                // الفاتورة بتفتح صفحة كاملة؛ الصفقة بس هي اللي لسه بتتفرد تحت السطر
                const open = expanded.has(r.id) && !!r.invoiceItems?.length && !r.invoiceUid;
                return (
                  <Fragment key={r.id}>
                    <tr className="pl-row">
                      <td className="muted pl-date" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                      <td className="pl-note">
                        {r.invoiceUid
                          ? <button className="btn btn-ghost btn-sm" onClick={() => setOpenInvoice({ uid: r.invoiceUid!, docNo: r.docNo ?? null })}>📄 {r.note || 'فاتورة'}</button>
                          : r.invoiceItems?.length
                            ? <button className="btn btn-ghost btn-sm" onClick={() => toggle(r.id)}>{open ? '▾' : '▸'} {r.note || 'صفقة'}</button>
                            : (r.note ?? '—')}
                      </td>
                      <td className="num deb pl-deb" data-l="عليه">{r.debit ? EGP(r.debit) : ''}</td>
                      <td className="num cre pl-cre" data-l="له">{r.credit ? EGP(r.credit) : ''}</td>
                      {kind === 'all' && (
                        <td className="num pl-bal" style={{ fontWeight: 700, color: r.balance <= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                          {EGP(Math.abs(r.balance))} {r.balance <= 0 ? 'له' : 'عليه'}
                        </td>
                      )}
                    </tr>
                    {open && (
                      <tr className="pi-row">
                        <td colSpan={cols} style={{ background: '#eef4fa', borderInlineStart: '3px solid var(--blue, #2c5a86)', padding: '8px 16px' }}>
                          <table className="pi-items" style={{ width: '100%', color: 'var(--ink)' }}>
                            <thead><tr><th>الكمية</th><th>الصنف</th><th>السعر</th><th>الإجمالي</th></tr></thead>
                            <tbody>
                              {r.invoiceItems!.map((it, j) => (
                                <tr key={j}>
                                  <td className="num" data-l="عدد">{it.qty}</td>
                                  <td>{it.name}</td>
                                  <td className="num" data-l="سعر">{EGP(it.price)}</td>
                                  <td className="num">{EGP(it.qty * it.price)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {(visibleRows.length > 0 || opening !== 0) && (
                <>
                  <tr className="mf-total">
                    <td colSpan={2} style={{ fontWeight: 800 }}>
                      الإجمالي{opening !== 0 ? ' (شامل الرصيد الافتتاحي)' : ''}
                    </td>
                    <td className="num deb">{EGP(totalDebit)}</td>
                    <td className="num cre">{EGP(totalCredit)}</td>
                    {kind === 'all' && (
                      <td className="num" style={{ fontWeight: 800, color: net <= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                        {EGP(Math.abs(net))} {net <= 0 ? 'له' : 'عليه'}
                      </td>
                    )}
                  </tr>
                  {kind !== 'all' && (
                    <tr className="mf-total">
                      <td colSpan={cols} style={{ fontWeight: 800, textAlign: 'left' }}>
                        الصافي:{' '}
                        <span className="num" style={{ color: net <= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                          {EGP(Math.abs(net))} {net <= 0 ? 'له' : 'عليه'}
                        </span>
                      </td>
                    </tr>
                  )}
                </>
              )}
              {visibleRows.length === 0 && opening === 0 && <tr><td colSpan={cols} className="empty">لا توجد حركات</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="page-title num" style={{ marginTop: 14, textAlign: 'left' }}>
          الرصيد الجاري: {EGP(Math.abs(data.balance))} {data.balance <= 0 ? 'له' : 'عليه'}
        </div>
        <div ref={bottomRef} />
      </div>
    </>
  );
}

// ─── invoices tab: تاب لكل فاتورة وجنبه تاب استلاماتها بنفس الرقم ──────────────

/**
 * عربيات الفاتورة في البوابة — نفس شكل كشف الاستلام بالحرف زي السيستم الداخلي:
 * ترويسة أبو شامة، خانات العميل والسائق والعربية، جدول الأصناف، ثم المصاريف بلون
 * مختلف، والإقرار. ولون التاب والكشف حسب وصلت / في الطريق.
 */
function PortalManifestTabs({ invoiceUid, cur }: { invoiceUid: string; cur: 'EGP' | 'USD' }) {
  const { data, isLoading } = useMyManifestTabs(invoiceUid);
  const [active, setActive] = useState(0);

  if (isLoading || !data || data.tabs.length === 0) return null;
  const tab = data.tabs[Math.min(active, data.tabs.length - 1)];
  const label = (t: MyManifestTab) => t.vehicleLabel || `عربية رقم ${t.no}`;
  const totalQty = tab.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);

  return (
    <div className="mt-wrap">
      <div className="mt-bar" role="tablist">
        {data.tabs.map((t, i) => (
          <button key={t.id} role="tab" aria-selected={i === active}
            className={`mt-tab st-${t.status} ${i === active ? 'is-active' : ''}`} onClick={() => setActive(i)}>
            <span className="mt-dot" aria-hidden />
            {label(t)}
          </button>
        ))}
      </div>

      <div className={`mt-panel card st-${tab.status}`}>
        <div className="mt-head">
          <span className={`pill mt-status st-${tab.status}`}>{MT_STATUS_LABEL[tab.status]}</span>
        </div>

        <div className="card print-sheet mf-sheet">
          <div className="mf-logo">أبو شامة</div>
          <div className="mf-head">
            <h2>كشف استلام بضاعة</h2>
            <div className="mf-meta">
              <span>رقم: <b>{tab.no}</b></span>
              <span>التاريخ: <b>{fmtDate(tab.date)}</b></span>
            </div>
          </div>

          <div className="mf-grid">
            {[['اسم العميل', tab.clientName], ['اسم السائق', tab.driverName],
              ['مسمّى العربية', tab.vehicleLabel], ['رقم العربية', tab.vehicleNo],
              ['رقم المقطورة', tab.trailerNo]].map(([l, v]) => (
              <div key={l as string} className="mf-info">
                <span className="mf-info-l">{l}</span>
                <span className="mf-info-v">{v || '—'}</span>
              </div>
            ))}
          </div>

          <div className="tbl-wrap mf-grow">
            <table className="mt-tbl">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>الكمية</th>
                  <th>الصنف</th>
                  <th style={{ width: 110 }}>السعر</th>
                  <th style={{ width: 130 }}>الاجمالي</th>
                </tr>
              </thead>
              <tbody>
                {tab.items.map((it) => (
                  <tr key={it.id} className="mt-goods">
                    <td className="num">{it.qty}</td>
                    <td>{it.name}</td>
                    <td className="num">{it.price === null ? '—' : money(it.price, cur)}</td>
                    <td className="num">{it.total === null ? '—' : money(it.total, cur)}</td>
                  </tr>
                ))}
                {tab.items.length === 0 && (
                  <tr className="mt-goods"><td colSpan={4} className="empty">مفيش أصناف في الكشف</td></tr>
                )}
                <tr className="mt-sub mt-goods">
                  <td className="num"><b>{totalQty}</b></td>
                  <td><b>إجمالي العدد</b></td>
                  <td />
                  <td className="num">{money(tab.itemsTotal, cur)}</td>
                </tr>

                <tr className="mt-split"><td colSpan={4}>مصاريف العربية</td></tr>
                {tab.expenses.map((e) => (
                  <tr key={e.id} className="mt-exp">
                    <td className="muted" style={{ fontSize: 12 }}>{fmtDate(e.date)}</td>
                    <td>{e.note || e.category || 'مصروف'}</td>
                    <td />
                    <td className="num">{money(e.amount, cur)}</td>
                  </tr>
                ))}
                {tab.expenses.length === 0 && (
                  <tr className="mt-exp"><td colSpan={4} className="empty">مفيش مصاريف</td></tr>
                )}
                <tr className="mt-sub mt-exp">
                  <td colSpan={3}>إجمالي المصاريف</td>
                  <td className="num">{money(tab.expensesTotal, cur)}</td>
                </tr>

                <tr className="mf-total">
                  <td colSpan={3}>إجمالي العربية</td>
                  <td className="num">{money(tab.itemsTotal + tab.expensesTotal, cur)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {tab.note && <p className="mf-note">ملاحظات: {tab.note}</p>}
        </div>
      </div>
    </div>
  );
}

function MyInvoiceTabs() {
  const { data: invoices, isLoading } = useMyInvoiceList();
  const [active, setActive] = useState(0);

  const list = invoices ?? [];
  // تاب الفاتورة وبعديه على طول تاب استلاماتها بنفس الرقم
  const tabs = list.flatMap((inv) => [
    { inv, kind: 'invoice' as const },
    { inv, kind: 'receipts' as const },
  ]);
  const cursor = tabs.length ? tabs[Math.min(active, tabs.length - 1)] : null;
  const { data: detail, isLoading: loadingDetail } = useMyInvoice(cursor?.inv.id ?? null);

  if (isLoading) return <div className="card" style={{ padding: 22 }}><div className="empty">جارٍ التحميل…</div></div>;
  if (!cursor) {
    return (
      <div className="card" style={{ padding: 22 }}>
        <div className="empty">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>لسه مفيش فواتير على حسابك</div>
          <div style={{ fontSize: 13 }}>أول ما تتسجّل لك فاتورة هتلاقيها هنا هي واستلاماتها.</div>
        </div>
      </div>
    );
  }

  const inv = cursor.inv;
  const cur = inv.currency ?? 'EGP';

  return (
    <div className="pit-wrap">
      <div className="pit-bar" role="tablist">
        {tabs.map((t, i) => (
          <button key={`${t.inv.id}:${t.kind}`} role="tab" aria-selected={i === active}
            className={`pit-tab ${t.kind === 'receipts' ? 'is-receipts' : ''} ${i === active ? 'is-active' : ''}`}
            onClick={() => setActive(i)}>
            <span>{t.kind === 'invoice' ? `فاتورة ${t.inv.no}` : `استلامات ${t.inv.no}`}</span>
            <span className="pit-tab-date">{fmtDate(t.inv.date)}</span>
          </button>
        ))}
      </div>

      <div className={`pit-panel card ${cursor.kind === 'receipts' ? 'is-receipts' : ''}`}>
        {loadingDetail || !detail ? (
          <div className="empty">جارٍ التحميل…</div>
        ) : cursor.kind === 'invoice' ? (
          <>
            <div className="pit-head">
              <div><b>فاتورة {inv.no}</b> <span className="muted" style={{ fontSize: 12 }}>{fmtDate(inv.date)}</span></div>
              <span className="pill">الإجمالي {EGP(detail.itemsTotal)}</span>
            </div>
            {/* نفس جسم ورقة الفاتورة المستخدَم في السيستم الداخلي بالحرف */}
            <InvoiceSheetBody
              items={detail.items}
              cur={cur}
              netTotal={detail.itemsTotal}
              discount={detail.discount}
              previousBalance={detail.previousBalance}
              cashTransfer={detail.cashTransfer}
              expensesTotal={detail.expensesTotal}
              paymentsTotal={detail.paymentsTotal}
              other={0}
              remaining={detail.remaining}
              isSale
            />
            <PortalManifestTabs invoiceUid={inv.id} cur={cur} />
          </>
        ) : (
          <InvoiceSheetPayments
            cur={cur}
            payments={detail.payments}
            total={detail.paymentsTotal}
            title={<>
              استلامات {inv.no}
              <span className="muted">{' — '}من {fmtDate(inv.date)} لحد الفاتورة اللي بعدها</span>
            </>}
          />
        )}
      </div>
    </div>
  );
}

// ─── manifests tab ────────────────────────────────────────────────────────────

const DOTS = '..........................';

function ManifestReadView({ m, onBack }: { m: MyManifest; onBack: () => void }) {
  const totalQty = m.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  return (
    <>
      <div className="toolbar no-print" style={{ marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع</button>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 طباعة</button>
      </div>
      <div className="card print-sheet mf-lines">
        <div className="mf-logo">أبو شامة</div>
        <div className="mf-head">
          <h2>كشف استلام بضاعة</h2>
          <div className="mf-meta">
            <span>رقم: <b>{m.no}</b></span>
            <span>التاريخ: <b>{fmtDate(m.date)}</b></span>
          </div>
        </div>
        <div className="mf-grid">
          {[['اسم العميل', m.clientName], ['اسم السائق', m.driverName], ['مسمّى العربية', m.vehicleLabel], ['الرقم القومي', m.driverNID], ['التليفون', m.driverPhone], ['رقم العربية', m.vehicleNo], ['رقم المقطورة', m.trailerNo]].map(([l, v]) => (
            <div key={l} className="mf-info"><span className="mf-info-l">{l}</span><span className="mf-info-v">{v || '—'}</span></div>
          ))}
        </div>
        <div className="tbl-wrap mf-grow">
          <table>
            <thead><tr><th style={{ width: 120 }}>الكمية</th><th>الصنف</th></tr></thead>
            <tbody>
              {m.items.map((it, i) => <tr key={i}><td className="num">{it.qty}</td><td>{it.name}</td></tr>)}
              <tr className="mf-total"><td className="num"><b>{totalQty}</b></td><td><b>إجمالي العدد</b></td></tr>
            </tbody>
          </table>
        </div>
        {m.note && <p className="mf-note">ملاحظات: {m.note}</p>}
        <div className="mf-ack">
          <p>أقر أنا / <b>{DOTS}</b> باستلام البضاعة المذكورة أعلاه، وأتعهد بالحفاظ على البضاعة المستلمة في حالتها الجيدة، والالتزام بتوصيلها إلى الجهة المحددة، كما أتعهد برد قيمة أي عجز أو تلف أو فقد يحدث بها لأي سبب يرجع لي.</p>
        </div>
      </div>
    </>
  );
}

const ARCHIVE_KEY = 'portal_archived_manifests';

function useArchivedManifests() {
  const [archived, setArchived] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]')); }
    catch { return new Set(); }
  });
  const toggle = (id: string) => setArchived((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...next]));
    return next;
  });
  return { archived, toggle };
}

function ManifestRow({ m, expanded, onToggle, onArchive, archiveLabel, onPrint }: {
  m: MyManifest; expanded: boolean; onToggle: () => void; onArchive: () => void; archiveLabel: string; onPrint: () => void;
}) {
  const totalQty = m.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  // نفس قاعدة السيستم الداخلي: فيه رحلة وصلت = وصلت؛ فيه رحلة لسه = في الطريق.
  const status = manifestTripStatus(m.driverTrips);
  return (
    <>
      <tr style={{ cursor: 'pointer', ...MT_ROW_TINT[status] }} onClick={onToggle}>
        <td><b>{m.no}</b></td>
        <td className="muted">{fmtDate(m.date)}</td>
        <td><span className={`pill mt-status st-${status}`}>{MT_STATUS_LABEL[status]}</span></td>
        <td>{m.driverName || '—'}</td>
        <td className="muted">{m.vehicleNo || '—'}</td>
        <td className="muted">{m.trailerNo || '—'}</td>
        <td>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, whiteSpace: 'nowrap' }}
            onClick={(e) => { e.stopPropagation(); onArchive(); }}
          >
            {archiveLabel}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: 0, background: 'var(--bg-soft)' }}>
            <div style={{ padding: '10px 16px' }}>
              <table style={{ width: '100%', fontSize: 13.5 }}>
                <thead>
                  <tr><th style={{ textAlign: 'right', width: 90 }}>الكمية</th><th style={{ textAlign: 'right' }}>الصنف</th></tr>
                </thead>
                <tbody>
                  {m.items.map((it, i) => <tr key={i}><td className="num">{it.qty}</td><td>{it.name}</td></tr>)}
                  <tr style={{ fontWeight: 700 }}><td className="num">{totalQty}</td><td>إجمالي العدد</td></tr>
                </tbody>
              </table>
              <div className="toolbar" style={{ marginTop: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onPrint(); }}>🖨 عرض الكشف الكامل للطباعة</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ManifestsTab() {
  const { data, isLoading } = useMyManifests();
  const [printing, setPrinting] = useState<MyManifest | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const { archived, toggle } = useArchivedManifests();

  if (printing) return <ManifestReadView m={printing} onBack={() => setPrinting(null)} />;
  if (isLoading) return <div className="empty">جاري التحميل…</div>;
  if (!data?.length) return <div className="empty">لا توجد كشوفات عربيات مرتبطة بحسابك</div>;

  const byDate = (a: MyManifest, b: MyManifest) => new Date(b.date).getTime() - new Date(a.date).getTime();
  const active = data.filter((m) => !archived.has(m.id)).sort(byDate);
  const archiveList = data.filter((m) => archived.has(m.id)).sort(byDate);

  const thead = (
    <thead><tr><th>رقم</th><th>التاريخ</th><th>الحالة</th><th>السائق</th><th>العربية</th><th>المقطورة</th><th></th></tr></thead>
  );

  const toggleExpanded = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  return (
    <>
      <div className="tbl-wrap mf-list">
        <table>
          {thead}
          <tbody>
            {active.length === 0 && (
              <tr><td colSpan={7} className="empty">لا توجد كشوفات نشطة</td></tr>
            )}
            {active.map((m) => (
              <ManifestRow
                key={m.id} m={m}
                expanded={expandedId === m.id}
                onToggle={() => toggleExpanded(m.id)}
                onArchive={() => toggle(m.id)}
                archiveLabel="أرشفة ↓"
                onPrint={() => setPrinting(m)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowArchive((v) => !v)}
          style={{ fontSize: 13, marginBottom: 8 }}
        >
          {showArchive ? '▾' : '▸'} الأرشيف {archiveList.length > 0 ? `(${archiveList.length})` : ''}
        </button>

        {showArchive && (
          archiveList.length === 0
            ? <div className="empty" style={{ fontSize: 13 }}>الأرشيف فارغ</div>
            : (
              <div className="tbl-wrap mf-list">
                <table style={{ opacity: 0.75 }}>
                  {thead}
                  <tbody>
                    {archiveList.map((m) => (
                      <ManifestRow
                        key={m.id} m={m}
                        expanded={expandedId === m.id}
                        onToggle={() => toggleExpanded(m.id)}
                        onArchive={() => toggle(m.id)}
                        archiveLabel="↑ استعادة"
                        onPrint={() => setPrinting(m)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}
      </div>
    </>
  );
}

// ─── main portal ──────────────────────────────────────────────────────────────

type Tab = 'home' | 'orders' | 'ledger' | 'manifests';

const NAV: { key: Tab; label: string }[] = [
  { key: 'home', label: 'الرئيسية' },
  { key: 'orders', label: 'طلبياتي' },
  { key: 'ledger', label: 'كشف الحساب' },
  { key: 'manifests', label: 'كشف العربيات' },
];

export function CustomerPortal({ user }: { user: AuthUser }) {
  const [tab, setTab] = useState<Tab>('home');
  const { data: catalog } = useProductCatalog();
  const { data: ledger } = useMyLedgerBalance();
  const { data: ordersData } = useMyOrders();
  const products = catalog ?? [];
  const activeOrders = (ordersData?.data ?? []).filter((o) => o.status === 'NEW');

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>بوابة العميل</h1>
          {user.partyName && <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: 13 }}>أهلاً، <b>{user.partyName}</b></p>}
        </div>
        {activeOrders.length > 0 && (
          <button onClick={() => setTab('orders')} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--primary)', color: '#000',
            border: 'none', borderRadius: 12, padding: '8px 14px',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>
            <span style={{ fontSize: 16 }}>🔔</span>
            طلبياتي النشطة
          </button>
        )}
      </div>

      {/* nav */}
      <nav className="tabs" style={{ marginBottom: 20 }}>
        {NAV.map(({ key, label }) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}>{label}</button>
        ))}
      </nav>

      {/* home: الرصيد فوق، وتحته فواتير العميل بشكل التابات — ده اللي بيفتح عليه
          العميل حسابه على طول. الطلبيات اتشالت من هنا وفضلت في تاب «طلبياتي». */}
      {tab === 'home' && (
        <>
          <div className="pt-home-top">
            <div className="card" style={{ padding: 16, textAlign: 'center', minWidth: 190 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>الرصيد الحالي</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: ledger && ledger.balance <= 0 ? 'var(--credit)' : 'var(--debit)', direction: 'ltr' }}>
                {ledger ? EGP(Math.abs(ledger.balance)) : '…'}
              </div>
              {ledger && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {ledger.balance <= 0 ? 'له' : 'عليه'}
                </div>
              )}
            </div>
            <div className="pt-home-links">
              <button className="btn btn-ghost btn-sm" onClick={() => setTab('ledger')}>← كشف الحساب الكامل</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setTab('manifests')}>← كشف العربيات</button>
            </div>
          </div>

          <MyInvoiceTabs />
        </>
      )}

      {/* orders */}
      {tab === 'orders' && <OrdersTab products={products} />}

      {/* ledger */}
      {tab === 'ledger' && <LedgerTab partyName={user.partyName} />}

      {/* manifests */}
      {tab === 'manifests' && <ManifestsTab />}
    </div>
  );
}
