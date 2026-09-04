'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { money, EGP, fmtDate, todayISO } from '@/lib/format';
import { downloadElementAsPdf, printElementOnePage } from '@/lib/pdf';
import { replaceAmountInNote } from '@/lib/noteAmount';
import { PageTitle, DataTable, SegmentedControl, Spinner, Combobox, Field, MoneyInput, type Column } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { InvoiceDetailById } from '../../invoices/components/InvoiceDetail';
import { DealDetailById } from '../../deals/components/DealsView';
import { usePostEntry, useUpdateTransaction, useDeleteTransaction } from '../../transactions/hooks';
import { useParties, useParty, usePartyLedger } from '../hooks';
import { PartiesRegistry } from './PartiesRegistry';
import { TrialBalance } from './TrialBalance';
import type { Party, PartyRole, LedgerRow } from '../dtos';

// Open a party's ledger statement directly by uid — used by deep-links from the
// activity log and reports (RecordOpener) where only the party uid is known.
export function LedgerDetailById({ uid, onBack }: { uid: string; onBack: () => void }) {
  const { data, isLoading } = useParty(uid);
  if (isLoading || !data) return <Spinner />;
  return <LedgerDetail party={data} onBack={onBack} />;
}

type SortKey = 'name' | 'balance' | 'activity';
type LedgerKind = 'all' | 'invoices' | 'collect' | 'commission' | 'withdraw';
type MainTab = 'ledger' | 'mizan' | 'registry';

// USD accounts show the dollar figure as-is; the EGP equivalent (at the party's
// weighted-average rate) is shown in parentheses beside it. EGP accounts show plainly.
function amtWithEgp(amount: number | undefined | null, currency?: string | null, rate?: number) {
  if (currency === 'USD' && rate && rate > 0) {
    return `${money(amount, 'USD')} (${EGP((Number(amount) || 0) * rate)} ج.م)`;
  }
  return money(amount, currency as 'EGP' | 'USD' | null | undefined);
}

// ─── Ledger tab ───────────────────────────────────────────────────────────────

function LedgerTab() {
  const { user } = useAuth();
  const restrictedIds = user?.ledgerPartyIds ?? [];
  const isRestricted = !user?.admin && restrictedIds.length > 0;

  const [role, setRole] = useState<PartyRole>('CLIENT');
  const [moreOpen, setMoreOpen] = useState(false); // قائمة الثلاث نقاط (commission / عهدة)
  const [selected, setSelected] = useState<Party | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('balance');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useParties({ role, all: true });
  useEffect(() => { setPage(1); }, [role, search, sort]);

  if (selected) return <LedgerDetail party={selected} onBack={() => setSelected(null)} />;

  const all = data?.data ?? [];
  const filtered = all.filter((p) => {
    // ledgerPartyIds = قائمة إخفاء: الأطراف اللي فيها ماتظهرش.
    if (isRestricted && restrictedIds.includes(p.id)) return false;
    return p.name.includes(search.trim());
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'balance') return Math.abs(b.balance ?? 0) - Math.abs(a.balance ?? 0);
    if (sort === 'activity') return new Date(b.lastActivity ?? 0).getTime() - new Date(a.lastActivity ?? 0).getTime();
    return a.name.localeCompare(b.name, 'ar');
  });
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);
  const meta = { total, page, pageSize, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };

  const columns: Column<Party>[] = [
    { header: 'الاسم', cell: (p) => <span><b>{p.name}</b> {p.currency === 'USD' && <span className="pill">دولار</span>}</span> },
    { header: 'الهاتف', cell: (p) => p.phone || '—', className: 'muted' },
    { header: 'الرصيد', cell: (p) => <span className={(p.balance ?? 0) >= 0 ? 'deb' : 'cre'}>{amtWithEgp(p.balance, p.currency, p.avgExchangeRate)}</span>, className: 'num' },
  ];

  return (
    <>
      <div className="toolbar">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SegmentedControl
            value={role}
            onChange={(v) => setRole(v as PartyRole)}
            options={[
              { value: 'CLIENT', label: 'العملاء' },
              ...(!isRestricted ? [{ value: 'SUPPLIER', label: 'الموردين' }] : []),
            ]}
          />
          {!isRestricted && (
            <div style={{ position: 'relative' }}>
              <button
                className={`btn btn-sm ${role === 'AGENT' || role === 'PERSON' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setMoreOpen((o) => !o)}
                title="commission / عهدة"
                style={{ fontWeight: 800, fontSize: role === 'AGENT' || role === 'PERSON' ? 13 : 17, lineHeight: 1 }}
              >
                {role === 'AGENT' ? 'commission' : role === 'PERSON' ? 'عهدة' : '⋮'}
              </button>
              {moreOpen && (
                <div style={{ position: 'absolute', top: '100%', insetInlineStart: 0, zIndex: 30, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.12)', padding: 4, display: 'grid', gap: 2, minWidth: 150, marginTop: 4 }}>
                  <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => { setRole('AGENT'); setMoreOpen(false); }}>أصحاب commission</button>
                  <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => { setRole('PERSON'); setMoreOpen(false); }}>عهدة (أمانات/سلف)</button>
                </div>
              )}
            </div>
          )}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ padding: '10px 12px', border: '1.5px solid var(--line)', borderRadius: 10 }}>
          <option value="balance">ترتيب: الرصيد</option>
          <option value="name">ترتيب: أبجدي</option>
          <option value="activity">ترتيب: النشاط</option>
        </select>
        <div style={{ minWidth: 220 }}>
          <Combobox options={sorted} value="" onChange={(id) => { const p = all.find((x) => x.id === id); if (p) setSelected(p); }} placeholder="اكتب واختر بالاسم…" />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={pageRows}
        rowKey={(p) => p.id}
        loading={isLoading}
        emptyText="لا يوجد"
        onRowClick={setSelected}
        meta={meta}
        onPage={setPage}
        pageSize={pageSize}
      />
    </>
  );
}

// أقل ارتفاع لنافذة الجدول — لو الشاشة قصيرة أوي بنسمح للصفحة تسكرول شوية بدل ما
// الكشف يبقى شقّ ما ينفعش يتقرا.
const MIN_BOX = 260;

// أول يوم في الشهر الحالي بصيغة YYYY-MM-DD (توقيت محلي)
function startOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function LedgerDetail({ party, onBack }: { party: Party; onBack: () => void }) {
  const { can } = useAuth();
  const cur = party.currency ?? 'EGP';
  // افتراضيًا الكشف من أول الشهر — والمستخدم يقدر يوسّع الفترة من الفلتر.
  const [from, setFrom] = useState(startOfMonthISO());
  const [to, setTo] = useState('');
  const [kind, setKind] = useState<LedgerKind>('all');
  const { data, isLoading } = usePartyLedger(party.id, { from: from || undefined, to: to || undefined });
  const [sel, setSel] = useState<LedgerRow | null>(null);
  const [selEditing, setSelEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  // ملاحظة تظهر للعميل في بوابته بدل "استلام نقدية"
  const [editClientNote, setEditClientNote] = useState('');
  const [editErr, setEditErr] = useState('');
  // keep the amount inside البيان in sync while editing (unless the note is hand-edited)
  const noteTouched = useRef(false);
  const syncedAmt = useRef(0);
  const onEditAmountChange = (v: string) => {
    setEditAmount(v);
    if (noteTouched.current) return;
    const newAmt = Number(v) || 0;
    setEditNote((prev) => {
      const next = replaceAmountInNote(prev, syncedAmt.current, newAmt);
      if (next !== prev) syncedAmt.current = newAmt;
      return next;
    });
  };
  const updateTxn = useUpdateTransaction();
  const deleteTxn = useDeleteTransaction();
  const [invoiceUid, setInvoiceUid] = useState<string | null>(null);
  const [dealUid, setDealUid] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const sheetRef = useRef<HTMLDivElement>(null);
  // نافذة الجدول اللي بتسكرول جوّه الكشف (شوف الـ effect تحت).
  const scrollBoxRef = useRef<HTMLDivElement>(null);
  const scrolledKey = useRef<string | null>(null);
  const [showSettle, setShowSettle] = useState(false);
  const [wDate, setWDate] = useState(() => todayISO());
  const [wAmount, setWAmount] = useState('');
  const [wDir, setWDir] = useState<'debit' | 'credit'>('debit');
  const [wNote, setWNote] = useState('');
  const [wError, setWError] = useState('');
  const [wMsg, setWMsg] = useState('');
  const postEntry = usePostEntry();

  // الجدول بيشتغل كنافذة جوّه الكشف: بياخد المساحة الفاضلة لحد آخر الشاشة وبيسكرول
  // لوحده، فالصفحة نفسها ما بتتحركش — التولبارات (الفترة / كل الفترة / نوع الحركات)
  // وترويسة الكشف والرصيد الجاري فاضلين في مكانهم. والنافذة بتفتح على آخر معاملة
  // (تحت) والمستخدم يطلع فوق للأقدم.
  //
  // scrollKey بيحدد إمتى نرجع ننزل تحت: تغيير الطرف أو الفترة أو نوع الحركات —
  // ومش بينزل مع إعادة الرسم العادية (فتح تفاصيل صف / نافذة تعديل) عشان ما ينطّش
  // من تحت إيد المستخدم وهو بيشتغل.
  const scrollKey = `${party.id}|${from}|${to}|${kind}`;
  // بنستعيد حشو أسفل الصفحة (المحجوز لشريط النوافذ المصغّرة) طول ما الكشف مفتوح —
  // مساحة ميتة تحت الكشف كانت بتاكل من ارتفاع الجدول من غير أي فايدة.
  useEffect(() => {
    document.body.classList.add('ledger-fit');
    return () => document.body.classList.remove('ledger-fit');
  }, []);

  useEffect(() => {
    const el = scrollBoxRef.current;
    if (isLoading || !data || !el) return;

    // الارتفاع متحسب من مكان الجدول الفعلي على الشاشة ناقص اللي تحته جوّه الكشف
    // (سطر الرصيد الجاري + padding الكارت) — مش رقم ثابت، عشان يظبط لو التولبارات
    // لفّت سطرين على شاشة صغيرة أو الويندو اتغيّر حجمها.
    const fit = () => {
      let below = 0;
      for (let n = el.nextElementSibling; n; n = n.nextElementSibling) below += (n as HTMLElement).offsetHeight;
      const sheet = el.parentElement;
      if (sheet) below += parseFloat(getComputedStyle(sheet).paddingBottom) || 0;
      const avail = window.innerHeight - el.getBoundingClientRect().top - below - 12;
      el.style.maxHeight = `${Math.max(MIN_BOX, Math.round(avail))}px`;
      // لو فضل أي فايض بيخلّي الصفحة نفسها تسكرول (حشو أسفل الصفحة مثلًا) نقصّه —
      // عشان التولبارات ما تطلعش فوق خالص والسكرول يفضل جوّه الجدول بس.
      const over = document.documentElement.scrollHeight - window.innerHeight;
      if (over > 0) el.style.maxHeight = `${Math.max(MIN_BOX, Math.round(avail - over))}px`;
    };

    const jump = scrolledKey.current !== scrollKey;
    if (jump) {
      scrolledKey.current = scrollKey;
      window.scrollTo({ top: 0 }); // نرجّع الصفحة فوق الأول عشان القياس يطلع صح
    }
    // rAF مزدوج: نستنى الصفوف الجديدة تترسم فعلًا قبل ما نقيس وننزل لآخر سطر — من
    // غير كده بنحسب على ارتفاع الجدول القديم فبنقف في النص.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        fit();
        if (jump) el.scrollTop = el.scrollHeight;
      });
    });
    window.addEventListener('resize', fit);
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      window.removeEventListener('resize', fit);
    };
  }, [data, isLoading, scrollKey]);

  if (invoiceUid) return <InvoiceDetailById uid={invoiceUid} onBack={() => setInvoiceUid(null)} />;
  if (dealUid) return <DealDetailById uid={dealUid} onBack={() => setDealUid(null)} />;

  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filteredRows = (data?.rows ?? []).filter((r) => {
    if (kind === 'invoices') return !!(r.invoiceUid || r.dealUid);
    if (kind === 'collect') return !r.invoiceUid && !r.dealUid;
    if (kind === 'commission') return (r.credit ?? 0) > 0;
    if (kind === 'withdraw') return (r.debit ?? 0) > 0 && !r.invoiceUid && !r.dealUid;
    return true;
  });
  // الباك بيرجّع الأحدث فوق (مرتّب date+createdAt تنازلي) — نعكسها لترتيب زمني صح
  // شامل ترتيب حركات نفس اليوم. للفواتير نرتّب بتاريخ الكشف مع تثبيت الترتيب الزمني.
  const chrono = [...filteredRows].reverse();
  const visibleRows = kind === 'invoices'
    ? chrono.sort((a, b) => new Date(a.manifestDate ?? a.date).getTime() - new Date(b.manifestDate ?? b.date).getTime())
    : chrono;
  const totalDebit = visibleRows.reduce((s, r) => s + (r.debit || 0), 0);
  const totalCredit = visibleRows.reduce((s, r) => s + (r.credit || 0), 0);

  // rows with an expandable item breakdown, and a single show-all / hide-all toggle
  const detailRowIds = visibleRows.filter((r) => r.invoiceItems?.length).map((r) => r.id);
  const allExpanded = detailRowIds.length > 0 && detailRowIds.every((id) => expanded.has(id));
  const toggleAllDetails = () => setExpanded(allExpanded ? new Set() : new Set(detailRowIds));

  return (
    <>
      <div className="toolbar no-print">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع للقائمة</button>
        <span style={{ fontSize: 13 }}>من</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '8px 10px', border: '1.5px solid var(--line)', borderRadius: 10 }} />
        <span style={{ fontSize: 13 }}>إلى</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '8px 10px', border: '1.5px solid var(--line)', borderRadius: 10 }} />
        {(from || to) && <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); }}>كل الفترة</button>}
        <div style={{ flex: 1 }} />
        {party.role === 'AGENT' && can('invoices.commission') && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettle((v) => !v)}>+ تسوية commission</button>
        )}
        {data && <button className="btn btn-ghost btn-sm sp" onClick={() => sheetRef.current && downloadElementAsPdf(sheetRef.current, `كشف-حساب-${party.name}`)}>⬇ تحميل PDF</button>}
        {data && <button className="btn btn-primary btn-sm" onClick={() => sheetRef.current && printElementOnePage(sheetRef.current, `كشف-حساب-${party.name}`)}>🖨 طباعة</button>}
      </div>

      {showSettle && can('invoices.commission') && (
        <div className="card no-print" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>تسوية حساب — {party.name}</span>
            {data && (
              <span className="muted" style={{ fontSize: 13 }}>
                الرصيد الحالي:{' '}
                <span style={{ fontWeight: 700, color: (data.balance ?? 0) >= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                  {money(data.balance, cur)}
                </span>
              </span>
            )}
          </div>
          <div className="form-grid">
            <Field label="التاريخ"><input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} /></Field>
            <Field label="المبلغ"><MoneyInput value={wAmount} onChange={setWAmount} placeholder="0.00" /></Field>
            <Field label="النوع">
              <select
                value={wDir}
                onChange={(e) => setWDir(e.target.value as 'debit' | 'credit')}
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--line)', borderRadius: 10 }}
              >
                <option value="debit">خصم من الرصيد (يقلل ما له عندنا)</option>
                <option value="credit">إضافة للرصيد (يزيد ما له عندنا)</option>
              </select>
            </Field>
            <Field label="البيان" full><input value={wNote} onChange={(e) => setWNote(e.target.value)} placeholder="تسوية حساب" /></Field>
          </div>
          {wError && <div className="err-text">{wError}</div>}
          {wMsg && <div style={{ color: 'var(--credit)', fontWeight: 700 }}>{wMsg}</div>}
          <div className="toolbar" style={{ marginTop: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={postEntry.isPending}
              onClick={() => {
                setWError(''); setWMsg('');
                if (!wAmount || Number(wAmount) <= 0) return setWError('اكتب المبلغ');
                postEntry.mutate(
                  { type: 'adjust', date: wDate, amount: Number(wAmount), partyId: party.id, direction: wDir, note: wNote || 'تسوية حساب' },
                  {
                    onSuccess: () => { setWMsg('تم التسجيل ✓'); setWAmount(''); setWNote(''); },
                    onError: (e: any) => setWError(e.message),
                  },
                );
              }}
            >
              {postEntry.isPending ? '...' : 'حفظ'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowSettle(false); setWError(''); setWMsg(''); }}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="toolbar no-print">
        {(party.role === 'AGENT'
          ? [['all', 'كل الحركات'], ['commission', 'commission مكتسب'], ['withdraw', 'مسحوب']] as [LedgerKind, string][]
          : [['all', 'كشف الكل'], ['invoices', 'الفواتير فقط'], ['collect', 'التحصيل فقط']] as [LedgerKind, string][]
        ).map(([k, label]) => (
          <button key={k} className={`btn btn-sm ${kind === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setKind(k)}>{label}</button>
        ))}
        {detailRowIds.length > 0 && (
          <button className="btn btn-ghost btn-sm sp" onClick={toggleAllDetails}>
            {allExpanded ? '▾ إخفاء كل التفاصيل' : '▸ إظهار كل التفاصيل'}
          </button>
        )}
      </div>

      {isLoading || !data ? <Spinner /> : (
        <div ref={sheetRef} className="card print-sheet ledger-sheet">
          <div className="mf-logo">أبو شامة</div>
          <div className="mf-head">
            <h2>كشف حساب — {party.name}</h2>
            {data.linkedParty && (
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                كشف مدمج مع {data.linkedParty.role === 'SUPPLIER' ? 'مورد' : 'عميل'}: <b>{data.linkedParty.name}</b>
              </div>
            )}
          </div>
          <div className="muted" style={{ margin: '8px 4px' }}>
            رصيد افتتاحي: <span className="num">{amtWithEgp(data.opening, cur, party.avgExchangeRate)}</span>
            {(from || to) && <span> · الفترة: {from ? fmtDate(from) : '…'} ← {to ? fmtDate(to) : '…'}</span>}
          </div>
          <div ref={scrollBoxRef} className="tbl-wrap mf-grow ledger-scroll">
            <table className="lg-tbl">
              <thead>
                <tr>
                  <th>التاريخ</th><th>النوع</th><th>البيان</th><th>عليه</th><th>له</th>
                  {kind === 'all' && <th>الرصيد</th>}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => {
                  const open = expanded.has(r.id) && !!r.invoiceItems?.length;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className="lg-row"
                        style={{
                          cursor: 'pointer',
                          ...(r.manifestDate && r.manifestArrived === true
                            ? { background: 'rgba(178,58,46,0.10)', borderRight: '3px solid var(--debit)' }
                            : r.manifestDate && r.manifestArrived === false
                            ? { background: 'rgba(15,110,92,0.10)', borderRight: '3px solid var(--credit)' }
                            : {}),
                        }}
                        onClick={() => {
                          if (r.invoiceUid) { setInvoiceUid(r.invoiceUid); return; }
                          if (r.dealUid) { setDealUid(r.dealUid); return; }
                          setSel(r);
                          setSelEditing(false);
                          setEditDate(r.date.slice(0, 10));
                          setEditAmount(String(r.debit || r.credit));
                          setEditNote(r.note ?? '');
                          setEditClientNote(r.clientNote ?? '');
                          setEditErr('');
                          noteTouched.current = false;
                          syncedAmt.current = Number(r.debit || r.credit) || 0;
                        }}
                      >
                        <td className="lg-date">
                          {r.manifestDate ? (
                            <span>
                              {fmtDate(r.manifestDate)}
                              {r.manifestNo && <span className="muted" style={{ fontSize: 11, display: 'block' }}>عربية {r.manifestNo}</span>}
                            </span>
                          ) : fmtDate(r.date)}
                        </td>
                        <td className="lg-type">{r.type}</td>
                        <td className="lg-note" style={{ color: 'var(--ink)', fontWeight: 400 }}>
                          {data.linkedParty && r.partyRole && (
                            <span className="pill" style={{ fontSize: 10, marginInlineEnd: 4, opacity: 0.75 }}>
                              {r.partyRole === 'SUPPLIER' ? 'مورد' : 'عميل'}
                            </span>
                          )}
                          {r.invoiceItems?.length
                            ? <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); toggle(r.id); }}>{open ? '▾' : '▸'} {r.note || 'تفاصيل الفاتورة'}</button>
                            : r.note}
                        </td>
                        <td className="num deb lg-deb" data-l="عليه">{r.debit ? money(r.debit, cur) : ''}</td>
                        <td className="num cre lg-cre" data-l="له">{r.credit ? money(r.credit, cur) : ''}</td>
                        {kind === 'all' && <td className="num lg-bal" data-l="الرصيد">{money(r.balance, cur)}</td>}
                      </tr>
                      {open && (
                        <tr className="lg-items-row">
                          <td colSpan={6} style={{ background: '#f3ecda', borderInlineStart: '3px solid var(--gold, #b98a2e)', padding: '8px 16px' }}>
                            <table className="lg-items" style={{ width: '100%', color: 'var(--ink)' }}>
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
                {visibleRows.length > 0 && (
                  <tr className="mf-total">
                    <td colSpan={3} style={{ fontWeight: 800 }}>الإجمالي</td>
                    <td className="num deb">{money(totalDebit, cur)}</td>
                    <td className="num cre">{money(totalCredit, cur)}</td>
                    {kind === 'all' && <td className="num">{money(data.balance, cur)}</td>}
                  </tr>
                )}
                {visibleRows.length === 0 && <tr><td colSpan={6} className="empty">لا توجد حركات</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="page-title num lg-running" style={{ marginTop: 14, textAlign: 'left' }}>الرصيد الجاري: {amtWithEgp(data.balance, cur, party.avgExchangeRate)}</div>
        </div>
      )}

      {sel && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={() => setSel(null)}
        >
          <div
            className="card"
            style={{ padding: 20, minWidth: 320, maxWidth: 440, width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
              {selEditing ? 'تعديل الحركة' : 'تفاصيل الحركة'}
            </div>

            {!selEditing ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 20px', alignItems: 'baseline' }}>
                  <span className="muted" style={{ fontSize: 13 }}>التاريخ</span><span>{fmtDate(sel.date)}</span>
                  <span className="muted" style={{ fontSize: 13 }}>النوع</span><span>{sel.type}</span>
                  {sel.note && <><span className="muted" style={{ fontSize: 13 }}>البيان</span><span>{sel.note}</span></>}
                  {!sel.invoiceUid && !sel.dealUid && (
                    <>
                      <span className="muted" style={{ fontSize: 13 }}>يشوفه العميل</span>
                      <span>{sel.clientNote || (sel.credit > 0 ? 'استلام نقدية' : sel.note || '—')}</span>
                    </>
                  )}
                  {sel.debit > 0 && <><span className="muted" style={{ fontSize: 13 }}>عليه</span><span className="deb num">{EGP(sel.debit)}</span></>}
                  {sel.credit > 0 && <><span className="muted" style={{ fontSize: 13 }}>له</span><span className="cre num">{EGP(sel.credit)}</span></>}
                  <span className="muted" style={{ fontSize: 13 }}>الرصيد</span><span className="num">{EGP(sel.balance)}</span>
                </div>
                <div className="toolbar" style={{ marginTop: 14 }}>
                  {!sel.invoiceUid && !sel.dealUid && can('entry.edit') && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelEditing(true)}>✏ تعديل</button>
                  )}
                  {!sel.invoiceUid && !sel.dealUid && can('entry.delete') && (
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={deleteTxn.isPending}
                      onClick={() => {
                        if (!window.confirm(`حذف الحركة "${sel.type}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
                        deleteTxn.mutate(sel.id, { onSuccess: () => setSel(null) });
                      }}
                    >
                      حذف
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => setSel(null)}>إغلاق</button>
                </div>
              </>
            ) : (
              <>
                <div className="form-grid">
                  <Field label="التاريخ">
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                  </Field>
                  <Field label="المبلغ">
                    <MoneyInput value={editAmount} onChange={onEditAmountChange} />
                  </Field>
                  <Field label="البيان" full>
                    <input value={editNote} onChange={(e) => { noteTouched.current = true; setEditNote(e.target.value); }} placeholder="البيان…" />
                  </Field>
                  <Field label="ملاحظة تظهر للعميل (اختياري)" full>
                    <input value={editClientNote} onChange={(e) => setEditClientNote(e.target.value)} placeholder="من غيرها العميل بيشوف: استلام نقدية" />
                  </Field>
                </div>
                {editErr && <div className="err-text" style={{ marginTop: 8 }}>{editErr}</div>}
                <div className="toolbar" style={{ marginTop: 14 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={updateTxn.isPending}
                    onClick={() => {
                      setEditErr('');
                      updateTxn.mutate(
                        { id: sel.id, dto: { date: editDate, amount: Number(editAmount) || undefined, note: editNote || undefined, clientNote: editClientNote } },
                        {
                          onSuccess: () => { setSel(null); setSelEditing(false); },
                          onError: (e: any) => setEditErr(e.message ?? 'حدث خطأ'),
                        },
                      );
                    }}
                  >
                    {updateTxn.isPending ? '...' : 'حفظ'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelEditing(false)}>رجوع</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Registry tab — delegates to shared PartiesRegistry ───────────────────────

// ─── Root ─────────────────────────────────────────────────────────────────────

export function LedgerView() {
  const { user } = useAuth();
  const isRestricted = !user?.admin && (user?.ledgerPartyIds?.length ?? 0) > 0;
  const [tab, setTab] = useState<MainTab>('ledger');
  // Party whose statement is open from the ميزان tab (click a row → its ledger).
  const [mizanParty, setMizanParty] = useState<string | null>(null);

  return (
    <>
      <PageTitle title="كشف الحساب" />
      {!isRestricted && (
        <nav className="tabs" style={{ marginBottom: 16 }}>
          <button className={tab === 'ledger' ? 'active' : ''} onClick={() => setTab('ledger')}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}>كشف الحساب</button>
          {/* ميزان الحسابات — visible only to the primary (owner) account */}
          {user?.isPrimary && (
            <button className={tab === 'mizan' ? 'active' : ''} onClick={() => setTab('mizan')}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}>ميزان الحسابات</button>
          )}
          <button className={tab === 'registry' ? 'active' : ''} onClick={() => setTab('registry')}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}>سجل العملاء والموردين</button>
        </nav>
      )}

      {(tab === 'ledger' || isRestricted) && <LedgerTab />}
      {tab === 'mizan' && !isRestricted && user?.isPrimary && (
        mizanParty
          ? <LedgerDetailById uid={mizanParty} onBack={() => setMizanParty(null)} />
          : <TrialBalance onOpenParty={setMizanParty} />
      )}
      {tab === 'registry' && !isRestricted && <PartiesRegistry />}
    </>
  );
}
