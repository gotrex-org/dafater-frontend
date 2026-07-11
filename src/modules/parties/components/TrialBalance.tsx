'use client';

import { useMemo, useRef, useState } from 'react';
import { EGP, USD, fmtDate, todayISO } from '@/lib/format';
import { downloadElementAsPdf } from '@/lib/pdf';
import { Spinner, SearchInput } from '@/components/common';
import { useAuth } from '@/lib/auth';
import type { Party } from '../dtos';
import { useParties } from '../hooks';

const ROLE_LABEL: Record<string, string> = { CLIENT: 'عميل', SUPPLIER: 'مورد', AGENT: 'صاحب عمولة' };

// Convert a party's balance to EGP. EGP parties pass through; USD parties use their
// weighted-average rate — returns { egp: null } when a USD party has no rate yet (can't
// be converted, so it's shown in $ only and left out of the EGP totals).
function toEgp(p: Party): { raw: number; isUSD: boolean; rate: number; egp: number | null } {
  const raw = p.balance ?? 0;
  const isUSD = p.currency === 'USD';
  const rate = p.avgExchangeRate ?? 0;
  return { raw, isUSD, rate, egp: isUSD ? (rate > 0 ? raw * rate : null) : raw };
}

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

  // Everything is unified in EGP — USD balances converted at each party's average rate.
  // Unconvertible USD parties (no rate yet) are excluded from the totals.
  const totals = useMemo(() => {
    let debit = 0, credit = 0;
    for (const p of rows) {
      const { egp } = toEgp(p);
      if (egp == null) continue;
      if (egp > 0) debit += egp; else if (egp < 0) credit += -egp;
    }
    return { debit, credit };
  }, [rows]);

  const net = totals.debit - totals.credit;

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
                <th style={{ width: 170 }}>عليه (بالمصري)</th>
                <th style={{ width: 170 }}>له (بالمصري)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const partner = p.linkedParty ?? p.linkedFrom;
                const { raw, isUSD, rate, egp } = toEgp(p);
                // For a USD party show "$X ≈ Y ج.م" (or "$X — بدون سعر صرف" if no rate);
                // EGP parties just show the EGP figure.
                const amount = (side: 'deb' | 'cre') => {
                  const onSide = side === 'deb' ? raw > 0 : raw < 0;
                  if (!onSide) return '';
                  const usdAbs = Math.abs(raw);
                  if (!isUSD) return EGP(usdAbs);
                  return egp == null
                    ? `${USD(usdAbs)} — بدون سعر صرف`
                    : `${USD(usdAbs)} (${EGP(Math.abs(egp))} ج.م)`;
                };
                return (
                  <tr key={p.id} onClick={() => onOpenParty(p.id)} style={{ cursor: 'pointer' }}>
                    <td>
                      <b>{p.name}</b>
                      {isUSD && <span className="pill" style={{ marginInlineStart: 6 }}>دولار{rate > 0 ? ` @ ${EGP(rate)}` : ''}</span>}
                      {partner && <span className="pill" style={{ marginInlineStart: 6, opacity: 0.75, fontSize: 10 }}>مدمج مع {partner.name}</span>}
                    </td>
                    <td className="muted">{ROLE_LABEL[p.role] ?? p.role}</td>
                    <td className="num deb">{amount('deb')}</td>
                    <td className="num cre">{amount('cre')}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={4} className="empty">لا توجد أرصدة</td></tr>}

              <tr className="mf-total">
                <td colSpan={2}><b>الإجمالي بالمصري</b></td>
                <td className="num deb"><b>{EGP(totals.debit)}</b></td>
                <td className="num cre"><b>{EGP(totals.credit)}</b></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="num" style={{ marginTop: 8, textAlign: 'left', fontSize: 15, fontWeight: 700 }}>
          الإجمالي بالمصري: {EGP(Math.abs(net))} ج.م {net >= 0 ? 'عليهم' : 'لهم'}
        </div>
      </div>
    </>
  );
}
