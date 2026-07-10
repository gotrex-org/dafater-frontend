'use client';

import { useMemo, useRef, useState } from 'react';
import { money, fmtDate, todayISO } from '@/lib/format';
import { downloadElementAsPdf } from '@/lib/pdf';
import { Spinner, SearchInput } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useParties } from '../hooks';

const ROLE_LABEL: Record<string, string> = { CLIENT: 'عميل', SUPPLIER: 'مورد', AGENT: 'صاحب عمولة' };
const CUR_LABEL: Record<string, string> = { EGP: 'جنيه', USD: 'دولار' };

// ميزان الحسابات — a trial-balance report listing every party (clients, suppliers,
// commission agents) with its net balance split into عليه (debit) / له (credit),
// plus column totals. Balance sign convention matches the ledger: > 0 = عليه (they
// owe us), < 0 = له (we owe them).
export function TrialBalance({ onOpenParty }: { onOpenParty: (uid: string) => void }) {
  const { user } = useAuth();
  const restrictedIds = user?.ledgerPartyIds ?? [];
  const isRestricted = !user?.admin && restrictedIds.length > 0;

  const { data, isLoading } = useParties({ all: true }); // no role → all parties
  const [search, setSearch] = useState('');
  const [showZeros, setShowZeros] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const list = data?.data ?? [];
    // Linked client↔supplier pairs share ONE combined balance that the backend
    // attaches to both sides — keep only one row per pair so the pair (and the
    // totals) aren't double-counted.
    const seen = new Set<string>();
    const deduped = list.filter((p) => {
      const partner = p.linkedParty ?? p.linkedFrom;
      if (!partner) return true;
      const key = [p.id, partner.id].sort().join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return deduped
      .filter((p) => !isRestricted || restrictedIds.includes(p.id))
      .filter((p) => (showZeros ? true : Math.abs(p.balance ?? 0) >= 0.005))
      .filter((p) => p.name.includes(search.trim()))
      .sort((a, b) => Math.abs(b.balance ?? 0) - Math.abs(a.balance ?? 0));
  }, [data, search, showZeros, isRestricted, restrictedIds]);

  // Totals are kept per-currency — EGP and USD balances can't be summed together.
  const totals = useMemo(() => {
    const byCur: Record<string, { debit: number; credit: number }> = {};
    for (const p of rows) {
      const cur = p.currency ?? 'EGP';
      const b = p.balance ?? 0;
      if (!byCur[cur]) byCur[cur] = { debit: 0, credit: 0 };
      if (b > 0) byCur[cur].debit += b;
      else if (b < 0) byCur[cur].credit += -b;
    }
    return byCur;
  }, [rows]);

  const multiCur = Object.keys(totals).length > 1;

  if (isLoading) return <Spinner />;

  return (
    <>
      <div className="toolbar no-print">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم…" />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={showZeros} onChange={(e) => setShowZeros(e.target.checked)} />
          إظهار الأرصدة الصفرية
        </label>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm sp" onClick={() => sheetRef.current && downloadElementAsPdf(sheetRef.current, 'ميزان-الحسابات')}>⬇ تحميل PDF</button>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 طباعة</button>
      </div>

      <div ref={sheetRef} className="card print-sheet ledger-sheet">
        <div className="mf-logo">أبو شامة</div>
        <div className="mf-head">
          <h2>ميزان الحسابات</h2>
          <div className="mf-meta">
            <span>التاريخ: <b>{fmtDate(todayISO())}</b></span>
            <span>عدد الحسابات: <b>{rows.length}</b></span>
          </div>
        </div>

        <div className="tbl-wrap mf-grow">
          <table>
            <thead>
              <tr>
                <th>الطرف</th>
                <th style={{ width: 90 }}>النوع</th>
                <th style={{ width: 130 }}>عليه</th>
                <th style={{ width: 130 }}>له</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const b = p.balance ?? 0;
                const partner = p.linkedParty ?? p.linkedFrom;
                return (
                  <tr key={p.id} onClick={() => onOpenParty(p.id)} style={{ cursor: 'pointer' }}>
                    <td>
                      <b>{p.name}</b>
                      {p.currency === 'USD' && <span className="pill" style={{ marginInlineStart: 6 }}>دولار</span>}
                      {partner && <span className="pill" style={{ marginInlineStart: 6, opacity: 0.75, fontSize: 10 }}>مدمج مع {partner.name}</span>}
                    </td>
                    <td className="muted">{ROLE_LABEL[p.role] ?? p.role}</td>
                    <td className="num deb">{b > 0 ? money(b, p.currency) : ''}</td>
                    <td className="num cre">{b < 0 ? money(-b, p.currency) : ''}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={4} className="empty">لا توجد أرصدة</td></tr>}

              {Object.entries(totals).map(([cur, t]) => (
                <tr key={cur} className="mf-total">
                  <td colSpan={2}><b>الإجمالي{multiCur ? ` (${CUR_LABEL[cur] ?? cur})` : ''}</b></td>
                  <td className="num deb"><b>{money(t.debit, cur as 'EGP' | 'USD')}</b></td>
                  <td className="num cre"><b>{money(t.credit, cur as 'EGP' | 'USD')}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {Object.entries(totals).map(([cur, t]) => {
          const net = t.debit - t.credit;
          return (
            <div key={cur} className="page-title num" style={{ marginTop: 8, textAlign: 'left' }}>
              الصافي{multiCur ? ` (${CUR_LABEL[cur] ?? cur})` : ''}: {money(Math.abs(net), cur as 'EGP' | 'USD')} {net >= 0 ? 'عليهم' : 'لهم'}
            </div>
          );
        })}
      </div>
    </>
  );
}
