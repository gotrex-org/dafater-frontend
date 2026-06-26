'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { money, EGP, fmtDate, todayISO } from '@/lib/format';
import { downloadElementAsPdf } from '@/lib/pdf';
import { PageTitle, DataTable, SegmentedControl, Spinner, DetailModal, Combobox, Field, MoneyInput, type Column } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { InvoiceDetailById } from '../../invoices/components/InvoiceDetail';
import { DealDetailById } from '../../deals/components/DealsView';
import { usePostEntry } from '../../transactions/hooks';
import { useParties, usePartyLedger } from '../hooks';
import { PartiesRegistry } from './PartiesRegistry';
import type { Party, PartyRole, LedgerRow } from '../dtos';

type SortKey = 'name' | 'balance' | 'activity';
type LedgerKind = 'all' | 'invoices' | 'collect';
type MainTab = 'ledger' | 'registry';

// ─── Ledger tab ───────────────────────────────────────────────────────────────

function LedgerTab() {
  const { user } = useAuth();
  const restrictedIds = user?.ledgerPartyIds ?? [];
  const isRestricted = !user?.admin && restrictedIds.length > 0;

  const [role, setRole] = useState<PartyRole>('CLIENT');
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
    if (isRestricted && role === 'CLIENT' && !restrictedIds.includes(p.id)) return false;
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
    { header: 'الرصيد', cell: (p) => <span className={(p.balance ?? 0) >= 0 ? 'deb' : 'cre'}>{money(p.balance, p.currency)}</span>, className: 'num' },
  ];

  return (
    <>
      <div className="toolbar">
        <SegmentedControl
          value={role}
          onChange={(v) => setRole(v as PartyRole)}
          options={[
            { value: 'CLIENT', label: 'العملاء' },
            ...(!isRestricted ? [
              { value: 'SUPPLIER', label: 'الموردين' },
              { value: 'AGENT', label: 'أصحاب commission' },
            ] : []),
          ]}
        />
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

function LedgerDetail({ party, onBack }: { party: Party; onBack: () => void }) {
  const { can } = useAuth();
  const cur = party.currency ?? 'EGP';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kind, setKind] = useState<LedgerKind>('all');
  const { data, isLoading } = usePartyLedger(party.id, { from: from || undefined, to: to || undefined });
  const [sel, setSel] = useState<LedgerRow | null>(null);
  const [invoiceUid, setInvoiceUid] = useState<string | null>(null);
  const [dealUid, setDealUid] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const sheetRef = useRef<HTMLDivElement>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [wDate, setWDate] = useState(() => todayISO());
  const [wAmount, setWAmount] = useState('');
  const [wNote, setWNote] = useState('');
  const [wError, setWError] = useState('');
  const [wMsg, setWMsg] = useState('');
  const postEntry = usePostEntry();

  if (invoiceUid) return <InvoiceDetailById uid={invoiceUid} onBack={() => setInvoiceUid(null)} />;
  if (dealUid) return <DealDetailById uid={dealUid} onBack={() => setDealUid(null)} />;

  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const visibleRows = (data?.rows ?? []).filter((r) => {
    if (kind === 'invoices') return !!(r.invoiceUid || r.dealUid);
    if (kind === 'collect') return !r.invoiceUid && !r.dealUid;
    return true;
  });

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
          <button className="btn btn-ghost btn-sm" onClick={() => setShowWithdraw((v) => !v)}>+ تسجيل سحب</button>
        )}
        {data && <button className="btn btn-ghost btn-sm sp" onClick={() => sheetRef.current && downloadElementAsPdf(sheetRef.current, `كشف-حساب-${party.name}`)}>⬇ تحميل PDF</button>}
        {data && <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 طباعة</button>}
      </div>

      {showWithdraw && can('invoices.commission') && (
        <div className="card no-print" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>تسجيل مبلغ أخذه {party.name}</div>
          <div className="form-grid">
            <Field label="التاريخ"><input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} /></Field>
            <Field label="المبلغ"><MoneyInput value={wAmount} onChange={setWAmount} placeholder="0.00" /></Field>
            <Field label="البيان" full><input value={wNote} onChange={(e) => setWNote(e.target.value)} placeholder="سحب commission" /></Field>
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
                  { type: 'adjust', date: wDate, amount: Number(wAmount), partyId: party.id, direction: 'debit', note: wNote || 'سحب commission' },
                  {
                    onSuccess: () => { setWMsg('تم التسجيل ✓'); setWAmount(''); setWNote(''); },
                    onError: (e: any) => setWError(e.message),
                  },
                );
              }}
            >
              {postEntry.isPending ? '...' : 'حفظ'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowWithdraw(false); setWError(''); setWMsg(''); }}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="toolbar no-print">
        {([['all', 'كشف الكل'], ['invoices', 'الفواتير فقط'], ['collect', 'التحصيل فقط']] as [LedgerKind, string][]).map(([k, label]) => (
          <button key={k} className={`btn btn-sm ${kind === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setKind(k)}>{label}</button>
        ))}
      </div>

      {isLoading || !data ? <Spinner /> : (
        <div ref={sheetRef} className="card print-sheet ledger-sheet">
          <div className="mf-logo">أبو شامة</div>
          <div className="mf-head"><h2>كشف حساب — {party.name}</h2></div>
          <div className="muted" style={{ margin: '8px 4px' }}>
            رصيد افتتاحي: <span className="num">{money(data.opening, cur)}</span>
            {(from || to) && <span> · الفترة: {from ? fmtDate(from) : '…'} ← {to ? fmtDate(to) : '…'}</span>}
          </div>
          <div className="tbl-wrap mf-grow">
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th><th>النوع</th><th>البيان</th><th>مدين</th><th>دائن</th>
                  {kind === 'all' && <th>الرصيد</th>}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => {
                  const open = expanded.has(r.id) && !!r.invoiceItems?.length;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        style={{ cursor: r.invoiceUid || r.dealUid ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (r.invoiceUid) { setInvoiceUid(r.invoiceUid); return; }
                          if (r.dealUid) { setDealUid(r.dealUid); return; }
                          setSel(r);
                        }}
                      >
                        <td>{fmtDate(r.date)}</td>
                        <td>{r.type}</td>
                        <td className="muted">
                          {r.invoiceItems?.length
                            ? <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); toggle(r.id); }}>{open ? '▾' : '▸'} {r.note || 'تفاصيل الفاتورة'}</button>
                            : r.note}
                        </td>
                        <td className="num deb">{r.debit ? money(r.debit, cur) : ''}</td>
                        <td className="num cre">{r.credit ? money(r.credit, cur) : ''}</td>
                        {kind === 'all' && <td className="num">{money(r.balance, cur)}</td>}
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={6} style={{ background: '#f0ddd0', borderInlineStart: '3px solid #b06a45', padding: '8px 16px' }}>
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
                {visibleRows.length === 0 && <tr><td colSpan={6} className="empty">لا توجد حركات</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="page-title num" style={{ marginTop: 14, textAlign: 'left' }}>الرصيد الجاري: {money(data.balance, cur)}</div>
        </div>
      )}

      {sel && (
        <DetailModal
          title="تفاصيل الحركة"
          onClose={() => setSel(null)}
          rows={[
            { label: 'التاريخ', value: fmtDate(sel.date) },
            { label: 'النوع', value: sel.type },
            { label: 'البيان', value: sel.note },
            { label: 'مدين', value: sel.debit ? EGP(sel.debit) : '' },
            { label: 'دائن', value: sel.credit ? EGP(sel.credit) : '' },
            { label: 'الرصيد بعد الحركة', value: EGP(sel.balance) },
          ]}
        />
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

  return (
    <>
      <PageTitle title="كشف الحساب" />
      {!isRestricted && (
        <nav className="tabs" style={{ marginBottom: 16 }}>
          <button className={tab === 'ledger' ? 'active' : ''} onClick={() => setTab('ledger')}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}>كشف الحساب</button>
          <button className={tab === 'registry' ? 'active' : ''} onClick={() => setTab('registry')}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}>سجل العملاء والموردين</button>
        </nav>
      )}

      {(tab === 'ledger' || isRestricted) && <LedgerTab />}
      {tab === 'registry' && !isRestricted && <PartiesRegistry />}
    </>
  );
}
