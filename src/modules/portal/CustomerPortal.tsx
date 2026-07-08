'use client';

import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, EGP } from '@/lib/format';
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
  vehicleNo?: string | null; trailerNo?: string | null; driverName?: string | null;
  driverPhone?: string | null; driverNID?: string | null; note?: string | null;
  items: ManifestItem[];
  driverTrips?: { arrivalDate: string | null }[];
}

interface LedgerRow {
  id: string; date: string; type: string; note?: string | null;
  debit: number; credit: number; balance: number;
  invoiceUid?: string | null; dealUid?: string | null;
  invoiceItems?: { name: string; qty: number; price: number }[] | null;
}

interface LedgerResponse { opening: number; balance: number; rows: LedgerRow[] }

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

function LedgerTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kind, setKind] = useState<LedgerKind>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data, isLoading } = useMyLedger({ from: from || undefined, to: to || undefined });

  const toggle = (id: string) =>
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (isLoading) return <div className="empty">جاري التحميل…</div>;
  if (!data) return null;

  const visibleRows = (data.rows ?? []).filter((r) => {
    if (kind === 'invoices') return !!(r.invoiceUid || r.dealUid);
    if (kind === 'collect') return !r.invoiceUid && !r.dealUid;
    return true;
  });

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 13 }}>من</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        <span className="muted" style={{ fontSize: 13 }}>إلى</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 }} />
        {(from || to) && <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); }}>كل الفترة</button>}
      </div>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        {([['all', 'كشف الكل'], ['invoices', 'الفواتير فقط'], ['collect', 'التحصيل فقط']] as [LedgerKind, string][]).map(([k, label]) => (
          <button key={k} className={`btn btn-sm ${kind === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setKind(k)}>{label}</button>
        ))}
      </div>

      <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
        رصيد افتتاحي: <b className="num">{EGP(data.opening)}</b>
      </div>

      {visibleRows.length === 0 && <div className="empty">لا توجد حركات</div>}

      {visibleRows.length > 0 && (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>التاريخ</th><th>البيان</th><th>عليه</th><th>له</th>
                {kind === 'all' && <th>الرصيد</th>}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const open = expanded.has(r.id) && !!r.invoiceItems?.length;
                return (
                  <Fragment key={r.id}>
                    <tr>
                      <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                      <td>
                        {r.invoiceItems?.length
                          ? <button className="btn btn-ghost btn-sm" onClick={() => toggle(r.id)}>{open ? '▾' : '▸'} {r.note || (r.invoiceUid ? 'فاتورة' : r.dealUid ? 'صفقة' : '—')}</button>
                          : (r.note ?? '—')}
                      </td>
                      <td className="num deb">{r.debit ? EGP(r.debit) : ''}</td>
                      <td className="num cre">{r.credit ? EGP(r.credit) : ''}</td>
                      {kind === 'all' && (
                        <td className="num" style={{ fontWeight: 700, color: r.balance <= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                          {EGP(Math.abs(r.balance))} {r.balance <= 0 ? 'له' : 'عليه'}
                        </td>
                      )}
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={kind === 'all' ? 5 : 4} style={{ background: '#f0ddd0', borderInlineStart: '3px solid #b06a45', padding: '8px 16px' }}>
                          <table style={{ width: '100%', color: 'var(--ink)' }}>
                            <thead><tr><th>الكمية</th><th>الصنف</th><th>السعر</th><th>الإجمالي</th></tr></thead>
                            <tbody>
                              {r.invoiceItems!.map((it, j) => (
                                <tr key={j}><td className="num">{it.qty}</td><td>{it.name}</td><td className="num">{EGP(it.price)}</td><td className="num">{EGP(it.qty * it.price)}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ textAlign: 'left', fontWeight: 800, fontSize: 15, marginTop: 12 }}>
        الرصيد الجاري: <span className="num">{EGP(data.balance)}</span>
      </div>
    </>
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
      <div className="card print-sheet">
        <div className="mf-logo">أبو شامة</div>
        <div className="mf-head">
          <h2>كشف استلام بضاعة</h2>
          <div className="mf-meta">
            <span>رقم: <b>{m.no}</b></span>
            <span>التاريخ: <b>{fmtDate(m.date)}</b></span>
          </div>
        </div>
        <div className="mf-grid">
          {[['اسم العميل', m.clientName], ['اسم السائق', m.driverName], ['الرقم القومي', m.driverNID], ['التليفون', m.driverPhone], ['رقم العربية', m.vehicleNo], ['رقم المقطورة', m.trailerNo]].map(([l, v]) => (
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
  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={onToggle}>
        <td><b>{m.no}</b></td>
        <td className="muted">{fmtDate(m.date)}</td>
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
          <td colSpan={6} style={{ padding: 0, background: 'var(--bg-soft)' }}>
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
    <thead><tr><th>رقم</th><th>التاريخ</th><th>السائق</th><th>العربية</th><th>المقطورة</th><th></th></tr></thead>
  );

  const toggleExpanded = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  return (
    <>
      <div className="tbl-wrap">
        <table>
          {thead}
          <tbody>
            {active.length === 0 && (
              <tr><td colSpan={6} className="empty">لا توجد كشوفات نشطة</td></tr>
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
              <div className="tbl-wrap">
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

      {/* home */}
      {tab === 'home' && (
        <div className="grid-sidebar">
          {/* left: balance + quick stats */}
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>الرصيد الحالي</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: ledger && ledger.balance <= 0 ? 'var(--credit)' : 'var(--debit)', direction: 'ltr' }}>
                {ledger ? EGP(Math.abs(ledger.balance)) : '…'}
              </div>
              {ledger && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {ledger.balance <= 0 ? 'له' : 'عليه'}
                </div>
              )}
            </div>

            <div
              className="card card-link"
              style={{ padding: 16 }}
              onClick={() => setTab('orders')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>طلبيات نشطة</span>
                <b style={{ fontSize: 18 }}>{activeOrders.length}</b>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setTab('ledger')} style={{ textAlign: 'right' }}>← كشف الحساب الكامل</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setTab('manifests')} style={{ textAlign: 'right' }}>← كشف العربيات</button>
            </div>
          </div>

          {/* right: new order form */}
          <OrderForm products={products} />
        </div>
      )}

      {/* orders */}
      {tab === 'orders' && <OrdersTab products={products} />}

      {/* ledger */}
      {tab === 'ledger' && <LedgerTab />}

      {/* manifests */}
      {tab === 'manifests' && <ManifestsTab />}
    </div>
  );
}
