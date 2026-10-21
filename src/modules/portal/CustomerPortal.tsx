'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, EGP, money } from '@/lib/format';
import { downloadElementAsPdf, printElementOnePage } from '@/lib/pdf';
import { normalizeAr, wordMatchScore } from '@/lib/arabicSearch';

// أول يوم في الشهر الحالي (توقيت محلي) — الكشف يبدأ منه افتراضيًا
function portalStartOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
import { ProductCombobox } from '../products/components/ProductCombobox';
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
  /** بنود الشحن على الفاتورة (نولون/تحميل…) بمبلغ كل بند */
  invoiceCharges?: { name: string; amount: number }[] | null;
  /** الفاتورة عليها ناولون = البضاعة اتشحنت من عندنا */
  shipped?: boolean;
}

interface LedgerResponse { opening: number; balance: number; rows: LedgerRow[] }

// فاتورة العميل بشكل الشيت — GET /invoices/my/:uid
interface MyInvoice {
  date: string;
  currency: 'EGP' | 'USD';
  items: { name: string; qty: number; price: number }[];
  /** إجمالي الأصناف بعد الخصم */
  /** بنود الشحن على الفاتورة (نولون/تحميل/شفتنة…) */
  charges?: { name: string; qty: number; price: number }[];
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
type LedgerView = 'mobile' | 'pc';
const LEDGER_VIEW_KEY = 'portal-ledger-view';

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
      <div className="empty">الفاتورة غير متاحة</div>
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
                {(data.charges ?? []).map((c, i) => (
                  <tr key={`c${i}`}>
                    <td className="num" data-l="عدد">{c.qty}</td>
                    <td>{c.name}</td>
                    <td className="num" data-l="سعر">{m(c.price)}</td>
                    <td className="num">{m(c.qty * c.price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="mf-total">
                  <td colSpan={3}>{data.charges?.length ? (data.discount > 0 ? 'إجمالي الفاتورة بعد الخصم' : 'إجمالي الفاتورة') : (data.discount > 0 ? 'إجمالي الأصناف بعد الخصم' : 'إجمالي الأصناف')}</td>
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

      {/* عربيات الفاتورة — كانت في تابات الرئيسية، بقت جوّه الفاتورة نفسها */}
      <PortalManifestTabs invoiceUid={uid} cur={data.currency} />
    </>
  );
}

function LedgerTab({ partyName }: { partyName?: string }) {
  // افتراضيًا من أول الشهر — قابل للتغيير من الفلتر
  const [from, setFrom] = useState(portalStartOfMonth());
  const [to, setTo] = useState('');
  // الافتراضي تاب الفواتير
  const [kind, setKind] = useState<LedgerKind>('invoices');
  // بحث باسم الصنف: يُبقي الفواتير والصفقات التي فيها الصنف فقط
  const [itemSearch, setItemSearch] = useState('');
  // الفاتورة بتتفتح صفحة كاملة بشكل الشيت من زرار «عرض الفاتورة» في صندوقها.
  const [openInvoice, setOpenInvoice] = useState<{ uid: string; docNo: number | null } | null>(null);
  const { data, isLoading } = useMyLedger({ from: from || undefined, to: to || undefined });
  const sheetRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didScroll = useRef(false);
  // بار التاريخ والبحث والتابات بيتثبّت تحت البار العلوي وتابات البوابة (الاتنين sticky)،
  // وارتفاعهم بيختلف بين الموبايل والكمبيوتر فبيتقاس.
  const [stickyTop, setStickyTop] = useState(0);
  useEffect(() => {
    const measure = () => {
      const h = document.querySelector('header.appbar')?.getBoundingClientRect().height ?? 0;
      const n = document.querySelector('nav.tabs')?.getBoundingClientRect().height ?? 0;
      setStickyTop(h + n);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // شكل العرض: كروت موبايل أو صناديق كمبيوتر. الافتراضي حسب عرض الشاشة، واختيار العميل
  // بيتحفظ على جهازه. بيتحدد بعد التحميل عشان مايختلفش عن اللي اترسم على السيرفر.
  const [view, setViewState] = useState<LedgerView>('pc');
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(LEDGER_VIEW_KEY); } catch { /* تخزين مقفول */ }
    setViewState(saved === 'mobile' || saved === 'pc' ? saved : window.innerWidth < 700 ? 'mobile' : 'pc');
  }, []);
  const setView = (v: LedgerView) => {
    setViewState(v);
    try { localStorage.setItem(LEDGER_VIEW_KEY, v); } catch { /* تخزين مقفول */ }
  };

  // تقسيم الفواتير: باليوم (الافتراضي) أو كل 10 أصناف في صندوق — برضه بيتحفظ على الجهاز.
  const [groupBy, setGroupByState] = useState<LedgerGroupBy>('day');
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(LEDGER_GROUP_KEY); } catch { /* تخزين مقفول */ }
    if (saved === 'day' || saved === 'ten') setGroupByState(saved);
  }, []);
  const setGroupBy = (g: LedgerGroupBy) => {
    setGroupByState(g);
    try { localStorage.setItem(LEDGER_GROUP_KEY, g); } catch { /* تخزين مقفول */ }
  };

  // أول ما البيانات تحمّل، انزل لآخر الكشف (أحدث معاملة) — والمستخدم يسكرول فوق للأقدم
  useEffect(() => {
    if (data && !didScroll.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ block: 'end' });
      didScroll.current = true;
    }
  }, [data]);

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
  const q = normalizeAr(itemSearch);
  const matchedItems = (r: LedgerRow) =>
    q ? (r.invoiceItems ?? []).filter((it) => wordMatchScore(it.name, q) != null) : [];
  // أسماء الأصناف اللي في كشف العميل نفسه — منها اقتراحات البحث
  const productNames = Array.from(new Set((data.rows ?? []).flatMap((r) => (r.invoiceItems ?? []).map((it) => it.name)).filter(Boolean)));
  const visibleRows = (data.rows ?? [])
    .filter((r) => {
      if (q && matchedItems(r).length === 0) return false;
      if (kind === 'invoices') return !!(r.invoiceUid || r.dealUid);
      // استلامات = الفلوس اللي العميل دفعها بس
      if (kind === 'collect') return (r.credit || 0) > 0 && !r.invoiceUid && !r.dealUid;
      return true;
    })
    .reverse();

  // الإجماليات تحت ثابتة لكل الفترة مهما كان التاب أو البحث: إجمالي البضاعة، إجمالي
  // الاستلامات، والإجمالي (شامل الرصيد الافتتاحي) = رصيد آخر الفترة.
  const opening = data.opening || 0;
  const periodRows = data.rows ?? [];
  const goodsTotal = periodRows.reduce((s, r) => s + (r.debit || 0), 0);
  const receiptsTotal = periodRows.reduce((s, r) => s + (r.credit || 0), 0);
  const grandTotal = opening + goodsTotal - receiptsTotal;
  const entries = buildLedgerEntries(visibleRows, groupBy, q);
  const openInvoiceOf = (r: LedgerRow) => setOpenInvoice({ uid: r.invoiceUid!, docNo: r.docNo ?? null });
  const renderEntries = (variant: LedgerView) => entries.map((e) => (e.type === 'receipt'
    ? <LedgerReceiptBox key={e.key} r={e.r} variant={variant} />
    : <LedgerGroupBox key={e.key} rows={e.rows} lines={e.lines} groupBy={groupBy} q={q} variant={variant} onOpenInvoice={openInvoiceOf} />));
  const emptyText = q ? 'لا توجد فواتير بهذا الصنف في الفترة المحددة'
    : kind === 'collect' ? 'لا توجد استلامات في الفترة المحددة'
    : kind === 'invoices' ? 'لا توجد فواتير في الفترة المحددة'
    : 'لا توجد حركات';

  return (
    <>
      <div className="no-print" style={{ position: 'sticky', top: stickyTop, zIndex: 15, background: 'var(--paper)', paddingTop: 8, marginBottom: 16 }}>
      <div className="toolbar" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 13 }}>من</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        <span className="muted" style={{ fontSize: 13 }}>إلى</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        {(from || to) && <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); }}>كل الفترة</button>}
        <ItemSearchBox value={itemSearch} onChange={setItemSearch} names={productNames} full={view === 'mobile'} />
        {itemSearch && <button className="btn btn-ghost btn-sm" title="مسح البحث" onClick={() => setItemSearch('')}>×</button>}
        <div style={{ flex: 1 }} />
        {kind !== 'collect' && (
          <div role="group" aria-label="تقسيم الفواتير" style={{ display: 'inline-flex', border: '1.5px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            {([['day', 'باليوم'], ['ten', 'كل 10 أصناف']] as [LedgerGroupBy, string][]).map(([g, label]) => (
              <button key={g} onClick={() => setGroupBy(g)} aria-pressed={groupBy === g}
                style={{
                  border: 'none', padding: '6px 12px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                  fontWeight: groupBy === g ? 800 : 500,
                  background: groupBy === g ? 'var(--ink)' : 'var(--surface)', color: groupBy === g ? '#fff' : 'var(--ink-soft)',
                }}>
                {label}
              </button>
            ))}
          </div>
        )}
        <div role="group" aria-label="شكل العرض" style={{ display: 'inline-flex', border: '1.5px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          {([['mobile', 'موبايل'], ['pc', 'كمبيوتر']] as [LedgerView, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
              style={{
                border: 'none', padding: '6px 12px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                fontWeight: view === v ? 800 : 500,
                background: view === v ? 'var(--ink)' : 'var(--surface)', color: view === v ? '#fff' : 'var(--ink-soft)',
              }}>
              {label}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => sheetRef.current && downloadElementAsPdf(sheetRef.current, `كشف-حساب${partyName ? '-' + partyName : ''}`)}>⬇ تحميل PDF</button>
        <button className="btn btn-primary btn-sm" onClick={() => sheetRef.current && printElementOnePage(sheetRef.current, `كشف-حساب${partyName ? '-' + partyName : ''}`)}>🖨 طباعة</button>
      </div>

      {/* التابات فلاتر على نفس الكشف: الفواتير بأصنافها / الاستلامات / الكل — بنفس طريقة العرض. */}
      <nav className="tabs" style={{ position: 'static' }}>
        {([['invoices', 'فواتير'], ['collect', 'استلامات'], ['all', 'كشف حساب']] as [LedgerKind, string][]).map(([k, label]) => (
          <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontWeight: kind === k ? 800 : 500,
              ...(kind === k ? { color: 'var(--ink)', borderBottom: '3px solid var(--ink)' } : {}),
            }}>
            {label}
          </button>
        ))}
      </nav>
      </div>

      {view === 'mobile' ? (
        <div ref={sheetRef} style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* رصيد العميل: أخضر لو له، أحمر لو عليه */}
          <div style={{ background: grandTotal <= 0 ? 'var(--credit)' : 'var(--debit)', color: '#fff', borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 13, opacity: 0.85 }}>رصيدك الحالي{partyName ? ` — ${partyName}` : ''}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span className="num" style={{ fontSize: 28, fontWeight: 800 }}>{EGP(Math.abs(grandTotal))}</span>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{grandTotal <= 0 ? 'لك' : 'عليك'}</span>
            </div>
            {(from || to) && (
              <div style={{ fontSize: 13, opacity: 0.85 }}>من {from ? fmtDate(from) : '…'} إلى {to ? fmtDate(to) : '…'}</div>
            )}
          </div>
          {renderEntries('mobile')}
          {visibleRows.length === 0 && <div className="empty">{emptyText}</div>}
          {(periodRows.length > 0 || opening !== 0) && (
            <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '14px 16px' }}>
              <LedgerTotals goods={goodsTotal} receipts={receiptsTotal} total={grandTotal} opening={opening} />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      ) : (
      <div ref={sheetRef} className="card print-sheet ledger-sheet ledger-old portal-sheet">
        <div className="pr-head">
          <div className="co">أبو شامة</div>
          <div className="ttl"><b>كشف حساب تفصيلي</b><br />عميل</div>
        </div>
        <div className="pr-meta">
          {partyName && <div><b>الاسم:</b> {partyName}</div>}
          <div>
            <b>رصيد افتتاحي:</b> <span className="num">{EGP(data.opening || 0)}</span>
            {(from || to) && <> · <b>الفترة:</b> {from ? fmtDate(from) : '…'} ← {to ? fmtDate(to) : '…'}</>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          {renderEntries('pc')}
          {visibleRows.length === 0 && <div className="empty">{emptyText}</div>}
        </div>

        {(periodRows.length > 0 || opening !== 0) && (
          <div style={{ borderTop: '2px solid var(--ink)', marginTop: 16, paddingTop: 12 }}>
            <LedgerTotals goods={goodsTotal} receipts={receiptsTotal} total={grandTotal} opening={opening} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      )}
    </>
  );
}

/** الإجماليات تحت الكشف — اللي على العميل بالأحمر واللي ليه بالأخضر. */
function LedgerTotals({ goods, receipts, total, opening }: { goods: number; receipts: number; total: number; opening: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '6px 24px', fontSize: 14 }}>
      <div>إجمالي البضاعة</div><div className="num" style={{ color: 'var(--debit)' }}>{EGP(goods)}</div>
      <div>إجمالي الاستلامات</div><div className="num" style={{ color: 'var(--credit)' }}>{EGP(receipts)}</div>
      <div style={{ fontWeight: 800, fontSize: 16 }}>
        الإجمالي
        {opening !== 0 && (
          <span className="muted" style={{ fontWeight: 500, fontSize: 12, marginInlineStart: 6 }}>
            (شامل الرصيد الافتتاحي {EGP(Math.abs(opening))} {opening <= 0 ? 'له' : 'عليه'})
          </span>
        )}
      </div>
      <div className="num" style={{ fontWeight: 800, fontSize: 16, color: total <= 0 ? 'var(--credit)' : 'var(--debit)' }}>
        {EGP(Math.abs(total))} {total <= 0 ? 'له' : 'عليه'}
      </div>
    </div>
  );
}

/**
 * بحث باسم الصنف بقايمة منسدلة: بتقترح أقرب أصناف للمكتوب (wordMatchScore — بالكلمات
 * ومن غير ترتيب)، والكتابة نفسها بتفلتر الكشف حتى من غير اختيار.
 */
function ItemSearchBox({ value, onChange, names, full = false }: {
  value: string; onChange: (v: string) => void; names: string[];
  /** في شكل الموبايل الخانة بتاخد سطر لوحدها بعرض البار */
  full?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const suggestions = value.trim()
    ? names
        .map((name) => ({ name, score: wordMatchScore(name, value) }))
        .filter((s): s is { name: string; score: number } => s.score != null)
        .sort((a, b) => b.score - a.score || a.name.length - b.name.length)
        .slice(0, 8)
        .map((s) => s.name)
    : names.slice().sort((a, b) => a.localeCompare(b, 'ar')).slice(0, 8);

  const pick = (name: string) => { onChange(name); setOpen(false); };

  return (
    <div style={{ position: 'relative', minWidth: 200, ...(full ? { flex: '1 1 100%' } : {}) }}>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !suggestions.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, suggestions.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); pick(suggestions[hi]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="بحث باسم الصنف…"
        aria-label="بحث باسم الصنف"
        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }}
      />
      {open && suggestions.length > 0 && (
        <ul role="listbox" style={{
          position: 'absolute', top: '100%', insetInlineStart: 0, insetInlineEnd: 0, zIndex: 30, margin: '4px 0 0', padding: 4,
          listStyle: 'none', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10,
          boxShadow: 'var(--shadow)', maxHeight: 280, overflowY: 'auto',
        }}>
          {suggestions.map((name, i) => (
            <li key={name} role="option" aria-selected={i === hi}
              onMouseDown={(e) => { e.preventDefault(); pick(name); }}
              onMouseEnter={() => setHi(i)}
              style={{ padding: '9px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, background: i === hi ? 'var(--line-soft)' : undefined }}>
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ألوان صناديق الكشف: الاستلامات بالدهبي، والفاتورة اللي اتشحنت من عندنا (عليها بند
// ناولون) بالرمادي. باقي الفواتير والحركات بالشكل المحايد (البيج).
const BOX_THEME = {
  receipt: { frame: '#b98a2e', head: '#f6ead2' },
  shipped: { frame: '#5a6b73', head: '#e4e7e9', dark: '#3d4a51', row: '#f1f3f4' },
};
const NAWLON_RE = /نا?ولون/;

type LedgerGroupBy = 'day' | 'ten';
const LEDGER_GROUP_KEY = 'portal-ledger-group';
const GROUP_SIZE = 10;

/** سطر جوّه صندوق: صنف أو بند شحن أو فرق الخصم، ومعاه الفاتورة اللي جاي منها. */
interface GroupLine {
  name: string;
  qty?: number;
  price?: number;
  amount: number;
  charge?: boolean;
  nawlon?: boolean;
  row: LedgerRow;
}

type LedgerEntry =
  | { type: 'receipt'; key: string; r: LedgerRow }
  | { type: 'group'; key: string; rows: LedgerRow[]; lines: GroupLine[] };

const isReceiptRow = (r: LedgerRow) => (r.credit || 0) > 0 && !r.invoiceUid && !r.dealUid;

/** أسطر الفاتورة: الأصناف، ثم بنود الشحن، ثم فرق الخصم (عشان مجموع الأسطر = مبلغ الفاتورة). */
function rowLines(r: LedgerRow, q: string): GroupLine[] {
  const items = (r.invoiceItems ?? []).filter((it) => !q || wordMatchScore(it.name, q) != null);
  const lines: GroupLine[] = items.map((it) => ({ name: it.name, qty: it.qty, price: it.price, amount: it.qty * it.price, row: r }));
  if (q) return lines; // مع البحث أسطر الصنف بس
  for (const c of r.invoiceCharges ?? []) {
    lines.push({ name: c.name, amount: c.amount, charge: true, nawlon: NAWLON_RE.test(c.name), row: r });
  }
  const diff = (r.debit || 0) - lines.reduce((s, l) => s + l.amount, 0);
  if (Math.abs(diff) >= 0.01) lines.push({ name: diff < 0 ? 'خصم' : 'أخرى', amount: diff, charge: true, row: r });
  return lines;
}

/**
 * تقسيم الكشف لصناديق حسب اختيار العميل: «باليوم» = كل فواتير اليوم في صندوق، و«كل 10
 * أصناف» = أسطر الفواتير ورا بعض كل 10 في صندوق. الاستلام صندوق لوحده دايماً وبيقفل
 * الصندوق اللي قبله، عشان الترتيب الزمني يفضل مظبوط.
 */
function buildLedgerEntries(rows: LedgerRow[], groupBy: LedgerGroupBy, q: string): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  type Acc = { rows: LedgerRow[]; lines: GroupLine[] };
  // «as» عشان TypeScript مايضيّقش النوع لـ null ويتجاهل اللي flush بتعمله
  let cur = null as Acc | null;
  const flush = () => {
    const c = cur;
    if (c && (c.rows.length || c.lines.length)) {
      out.push({ type: 'group', key: `g${out.length}-${c.rows[0]?.id}`, rows: c.rows, lines: c.lines });
    }
    cur = null;
  };

  for (const r of rows) {
    if (isReceiptRow(r)) { flush(); out.push({ type: 'receipt', key: r.id, r }); continue; }
    const lines = rowLines(r, q);
    const isDoc = !!(r.invoiceUid || r.dealUid);
    if (!isDoc) { flush(); out.push({ type: 'group', key: r.id, rows: [r], lines }); continue; }

    if (groupBy === 'day') {
      if (cur && fmtDate(cur.rows[0].date) !== fmtDate(r.date)) flush();
      cur ??= { rows: [], lines: [] };
      cur.rows.push(r);
      cur.lines.push(...lines);
    } else {
      for (const line of lines) {
        cur ??= { rows: [], lines: [] };
        if (!cur.rows.includes(r)) cur.rows.push(r);
        cur.lines.push(line);
        if (cur.lines.length >= GROUP_SIZE) flush();
      }
      // فاتورة اتفلترت أسطرها كلها بالبحث مابتظهرش
    }
  }
  flush();
  return out;
}

/** استلام: سطر واحد، التاريخ ← الملاحظة في النص (لو فيه) ← المبلغ. */
function LedgerReceiptBox({ r, variant }: { r: LedgerRow; variant: LedgerView }) {
  const theme = BOX_THEME.receipt;
  // «استلام نقدية» هو البيان الافتراضي من الباك، مش ملاحظة، فمابيظهرش.
  const note = r.note && r.note !== 'استلام نقدية' ? r.note : '';
  return (
    <div style={{ border: `2.5px solid ${theme.frame}`, borderRadius: variant === 'mobile' ? 14 : 12, overflow: 'hidden', breakInside: 'avoid' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', alignItems: 'center', gap: 12,
        background: theme.head, padding: '10px 14px', fontWeight: 700,
      }}>
        <span style={{ fontSize: 15 }}>{fmtDate(r.date)}</span>
        <span className="muted" style={{ fontWeight: 500, textAlign: 'center' }}>{note}</span>
        <span className="num">− {EGP(r.credit || 0)}</span>
      </div>
    </div>
  );
}

/** صندوق فواتير: فواتير يوم، أو 10 أسطر ورا بعض، أو حركة تانية لوحدها. */
function LedgerGroupBox({ rows, lines, groupBy, q, variant, onOpenInvoice }: {
  rows: LedgerRow[]; lines: GroupLine[]; groupBy: LedgerGroupBy; q: string; variant: LedgerView;
  onOpenInvoice: (r: LedgerRow) => void;
}) {
  const ship = BOX_THEME.shipped;
  const shipped = groupBy === 'day' ? rows.some((r) => r.shipped) : lines.some((l) => l.row.shipped);
  const docs = rows.filter((r) => r.invoiceUid || r.dealUid);
  const multiDoc = docs.length > 1;
  // باليوم المبلغ هو مبلغ الفواتير، ومع البحث أو كل 10 أسطر هو مجموع الأسطر الظاهرة
  const amount = groupBy === 'day' && !q && docs.length
    ? rows.reduce((s, r) => s + (r.debit || 0), 0)
    : lines.length ? lines.reduce((s, l) => s + l.amount, 0) : (rows[0]?.debit || 0);
  const first = fmtDate(rows[0].date);
  const last = fmtDate(rows[rows.length - 1].date);
  const dateLabel = first === last ? first : `${first} ← ${last}`;
  const docLabel = docs.length ? docs.map((r) => r.note || r.type).join('، ') : (rows[0].note || rows[0].type);
  const totalLabel = !docs.length ? 'المبلغ' : groupBy === 'day' ? (multiDoc ? 'إجمالي اليوم' : 'إجمالي الفاتورة') : 'إجمالي الأسطر';
  // في صندوق فيه أكتر من فاتورة كل سطر بيقول جاي منين
  const lineSource = (l: GroupLine) =>
    !multiDoc ? null : groupBy === 'ten' && first !== last ? `${fmtDate(l.row.date)} · ${l.row.note || ''}` : (l.row.note || '');

  const badge = shipped && (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: ship.dark, color: '#fff', borderRadius: 999, padding: '3px 10px', fontSize: 12 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 17V6H3v11h2" /><path d="M14 9h4l3 4v4h-2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /><path d="M9 17h6" />
      </svg>
      شحن من عندنا
    </span>
  );
  const invoiceButtons = docs.filter((r) => r.invoiceUid).map((r) => (
    <button key={r.id} className="btn btn-ghost btn-sm no-print" onClick={() => onOpenInvoice(r)}>
      {multiDoc ? `عرض ${r.note || 'الفاتورة'}` : 'عرض الفاتورة'}
    </button>
  ));
  const frame = shipped ? `2.5px solid ${ship.frame}` : '1px solid var(--line)';
  const head = shipped ? ship.head : 'var(--line-soft)';
  const lineStyle = (l: GroupLine, j: number) => (l.nawlon
    ? { borderTop: `1px dashed ${ship.frame}`, background: ship.row, color: ship.dark }
    : j ? { borderTop: '1px solid var(--line-soft)' } : {});

  if (variant === 'mobile') {
    return (
      <div style={{ background: 'var(--surface)', border: frame, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, background: head, padding: '12px 16px' }}>
          <b>{dateLabel}</b>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {badge}
            <span className="muted" style={{ fontSize: 12 }}>{docLabel}</span>
          </span>
        </div>
        <div style={{ padding: '4px 16px 10px', display: 'flex', flexDirection: 'column' }}>
          {lines.map((l, j) => (
            <div key={j} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', fontWeight: l.charge ? 700 : 400, ...lineStyle(l, j), ...(l.nawlon ? { margin: '0 -16px', padding: '8px 16px' } : {}) }}>
              <span>
                {l.name}
                {l.qty != null && <span className="muted num"> · {l.qty} × {EGP(l.price ?? 0)}</span>}
                {lineSource(l) && <span className="muted" style={{ display: 'block', fontSize: 11, fontWeight: 400 }}>{lineSource(l)}</span>}
              </span>
              <span className="num">{EGP(l.amount)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, borderTop: '1px solid var(--line-soft)', paddingTop: 8, fontWeight: 700 }}>
            <span>{totalLabel}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="num">{EGP(amount)}</span>
              {invoiceButtons}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: frame, borderRadius: 12, overflow: 'hidden', breakInside: 'avoid' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, background: head, padding: '10px 14px', fontWeight: 700 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15 }}>{dateLabel}</span>
          <span className="muted" style={{ fontWeight: 500 }}>· {docLabel}</span>
          {badge}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="num">{EGP(amount)}</span>
          {invoiceButtons}
        </span>
      </div>

      {lines.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {lines.map((l, j) => (
              <tr key={j} style={lineStyle(l, j)}>
                {l.charge ? (
                  <td colSpan={3} style={{ padding: '7px 14px', fontWeight: 700 }}>
                    {l.name}
                    {lineSource(l) && <span className="muted" style={{ fontSize: 11, fontWeight: 400, marginInlineStart: 8 }}>{lineSource(l)}</span>}
                  </td>
                ) : (
                  <>
                    <td style={{ padding: '7px 14px', fontWeight: 700 }}>
                      {l.name}
                      {lineSource(l) && <span className="muted" style={{ fontSize: 11, fontWeight: 400, marginInlineStart: 8 }}>{lineSource(l)}</span>}
                    </td>
                    <td className="num" style={{ padding: '7px 8px' }}>{l.qty}</td>
                    <td className="num" style={{ padding: '7px 8px' }}>× {EGP(l.price ?? 0)}</td>
                  </>
                )}
                <td className="num" style={{ padding: '7px 14px', textAlign: 'left' }}>{EGP(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

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

        <div className="card print-sheet mf-sheet mf-old">
          <div className="pr-head">
            <div className="co">أبو شامة</div>
            <div className="ttl"><b>الفاتورة</b><br />رقم: {tab.no}</div>
          </div>

          <table className="pr">
            <tbody>
              <tr>
                <td><b>تاريخ التحميل:</b> {fmtDate(tab.date)}</td>
                <td><b>رقم العربية:</b> {tab.vehicleNo || ''}</td>
                <td><b>اسم السائق:</b> {tab.driverName || ''}</td>
              </tr>
              <tr>
                <td><b>مسمّى العربية:</b> {tab.vehicleLabel || ''}</td>
                <td><b>رقم المقطورة:</b> {tab.trailerNo || ''}</td>
                <td><b>الاسم:</b> {tab.clientName || ''}</td>
              </tr>
            </tbody>
          </table>

          <div className="tbl-wrap mf-grow">
            <table className="pr mt-tbl">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>م</th>
                  <th>الاصناف</th>
                  <th style={{ width: 90 }}>العدد</th>
                  <th style={{ width: 110 }}>السعر</th>
                  <th style={{ width: 130 }}>الاجمالي</th>
                </tr>
              </thead>
              <tbody>
                {tab.items.map((it, i) => (
                  <tr key={it.id} className="mt-goods">
                    <td className="num">{i + 1}</td>
                    <td>{it.name}</td>
                    <td className="num">{it.qty}</td>
                    <td className="num">{it.price === null ? '—' : money(it.price, cur)}</td>
                    <td className="num">{it.total === null ? '—' : money(it.total, cur)}</td>
                  </tr>
                ))}
                {tab.items.length === 0 && (
                  <tr className="mt-goods"><td colSpan={5} className="empty">لا توجد أصناف في الكشف</td></tr>
                )}
                <tr className="mt-sub mt-goods">
                  <td />
                  <td><b>اجمالي العدد</b></td>
                  <td className="num"><b>{totalQty}</b></td>
                  <td />
                  <td className="num">{money(tab.itemsTotal, cur)}</td>
                </tr>

                <tr className="mt-split"><td colSpan={5}>مصاريف العربية</td></tr>
                {tab.expenses.map((e) => (
                  <tr key={e.id} className="mt-exp">
                    <td className="muted" style={{ fontSize: 12 }}>{fmtDate(e.date)}</td>
                    <td>{e.note || e.category || 'مصروف'}</td>
                    <td />
                    <td />
                    <td className="num">{money(e.amount, cur)}</td>
                  </tr>
                ))}
                {tab.expenses.length === 0 && (
                  <tr className="mt-exp"><td colSpan={5} className="empty">لا توجد مصاريف</td></tr>
                )}
                <tr className="mt-sub mt-exp">
                  <td colSpan={4}>إجمالي المصاريف</td>
                  <td className="num">{money(tab.expensesTotal, cur)}</td>
                </tr>

                <tr className="mf-total">
                  <td colSpan={4}>إجمالي العربية</td>
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

      {/* home: الرصيد فوق، وتحته كشف حساب العميل بنفس شكل السيستم الداخلي — ده اللي
          بيفتح عليه العميل حسابه على طول. الطلبيات اتشالت من هنا وفضلت في تاب «طلبياتي». */}
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
              <button className="btn btn-ghost btn-sm" onClick={() => setTab('manifests')}>← كشف العربيات</button>
            </div>
          </div>

          {/* الفواتير بتظهر للعميل كسطور في كشف حسابه زي السيستم الداخلي — الدوسة
              على سطر فاتورة بتفتح ورقتها كاملة بعربياتها. */}
          <LedgerTab partyName={user.partyName} />
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
