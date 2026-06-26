'use client';

import { useState } from 'react';
import { fmtDate, EGP, todayISO, QTY } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { Field, Combobox, MoneyInput } from '@/components/common';
import { useAllWarehouses } from '../../warehouses/hooks';
import { useAllProducts } from '../../products/hooks';
import { useAllTreasury } from '../../treasury/hooks';
import { useAllParties } from '../../parties/hooks';
import { useLoans, useCreateLoan, useReturnLoan, useDeleteLoan } from '../hooks';
import type { Loan, LoanReturn } from '../dtos';

function borrowerLabel(loan: Loan) {
  return loan.party?.name ?? loan.borrowerName ?? '—';
}

function LoanForm({ defaultWarehouseId, onClose }: { defaultWarehouseId: string; onClose: () => void }) {
  const { data: products } = useAllProducts();
  const { data: warehouses } = useAllWarehouses();
  const { data: parties } = useAllParties();
  const createLoan = useCreateLoan();

  const [date, setDate] = useState(todayISO());
  const [partyId, setPartyId] = useState('');
  const [productId, setProductId] = useState('');
  const [whId, setWhId] = useState(defaultWarehouseId);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const allParties = [
    ...(parties?.data?.filter((p: any) => p.role === 'CLIENT') ?? []).map((p: any) => ({ id: p.id, name: p.name + ' (عميل)' })),
    ...(parties?.data?.filter((p: any) => p.role === 'SUPPLIER') ?? []).map((p: any) => ({ id: p.id, name: p.name + ' (مورد)' })),
  ];

  const save = () => {
    setErr('');
    if (!partyId) return setErr('اختر المستعير');
    if (!productId) return setErr('اختر الصنف');
    if (!qty || Number(qty) <= 0) return setErr('اكتب الكمية');
    if (!whId) return setErr('اختر المخزن');
    createLoan.mutate(
      { date, partyId, productId, warehouseId: whId, qty: Number(qty), note: note || undefined },
      { onSuccess: () => onClose(), onError: (e: any) => setErr(e.message) },
    );
  };

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16, border: '1.5px dashed var(--primary)' }}>
      <b style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>تسجيل بضاعة مستعارة جديدة</b>
      <div className="form-grid">
        <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="المستعير (عميل / مورد)">
          <Combobox options={allParties} value={partyId} onChange={setPartyId} placeholder="اختر…" />
        </Field>
        <Field label="المخزن">
          <Combobox options={warehouses?.data ?? []} value={whId} onChange={setWhId} />
        </Field>
        <Field label="الصنف">
          <Combobox
            options={(products?.data ?? []).filter((p) => !(p as any).service).map((p) => ({ id: p.id, name: p.name + ((p as any).unit ? ' (' + (p as any).unit + ')' : '') }))}
            value={productId}
            onChange={setProductId}
            placeholder="اختر الصنف…"
          />
        </Field>
        <Field label="الكمية"><MoneyInput value={qty} onChange={setQty} placeholder="0" /></Field>
        <Field label="ملاحظة"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري…" /></Field>
      </div>
      {err && <div className="err-text" style={{ marginTop: 8 }}>{err}</div>}
      <div className="toolbar" style={{ marginTop: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={createLoan.isPending}>حفظ</button>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>إلغاء</button>
      </div>
    </div>
  );
}

const RETURN_TYPES = [
  { t: 'GOODS' as const, label: 'بضاعة', desc: 'ترجع للمخزن', color: 'var(--credit)' },
  { t: 'CASH'  as const, label: 'فلوس',  desc: 'دفع نقدي',    color: '#2563eb' },
  { t: 'DEBT'  as const, label: 'دين',   desc: 'على حساب العميل', color: 'var(--debit)' },
];

function ReturnHistoryRow({ r }: { r: LoanReturn }) {
  const cfg = RETURN_TYPES.find((x) => x.t === r.returnType)!;
  const total = r.pricePerUnit ? r.qty * r.pricePerUnit : null;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
      <span className="muted" style={{ minWidth: 80 }}>{fmtDate(r.date)}</span>
      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: cfg.color + '22', color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>
      <span>{QTY(r.qty)} وحدة</span>
      {total && <span className="muted">{EGP(total)}</span>}
      {r.note && <span className="muted">— {r.note}</span>}
    </div>
  );
}

function ReturnPanel({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const { data: treasury } = useAllTreasury();
  const { data: parties } = useAllParties();
  const returnLoan = useReturnLoan();

  const remaining = loan.qty - (loan.returnedQty ?? 0) - (loan.cashReturnedQty ?? 0);
  const hasParty = !!loan.party;

  const [returnDate, setReturnDate] = useState(todayISO());
  const [returnType, setReturnType] = useState<'GOODS' | 'CASH' | 'DEBT'>('GOODS');
  const [returnedQty, setReturnedQty] = useState(String(remaining));
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [treasuryId, setTreasuryId] = useState('');
  const [debtPartyId, setDebtPartyId] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [err, setErr] = useState('');

  const rQtyNum = Number(returnedQty) || 0;
  const priceNum = Number(pricePerUnit) || 0;
  const total = (returnType !== 'GOODS' && priceNum > 0) ? rQtyNum * priceNum : 0;

  const allParties = [
    ...(parties?.data?.filter((p: any) => p.role === 'CLIENT') ?? []).map((p: any) => ({ id: p.id, name: p.name + ' (عميل)' })),
    ...(parties?.data?.filter((p: any) => p.role === 'SUPPLIER') ?? []).map((p: any) => ({ id: p.id, name: p.name + ' (مورد)' })),
  ];

  const handleTypeChange = (t: typeof returnType) => {
    setReturnType(t); setReturnedQty(String(remaining)); setErr('');
  };

  const save = () => {
    setErr('');
    if (!rQtyNum || rQtyNum <= 0) return setErr('اكتب الكمية');
    if (rQtyNum > remaining + 0.001) return setErr('الكمية أكبر من المتبقية (' + QTY(remaining) + ')');
    if (returnType !== 'GOODS' && (!priceNum || priceNum <= 0)) return setErr('اكتب سعر القطعة');
    if (returnType === 'CASH' && !treasuryId) return setErr('اختر الخزنة');
    if (returnType === 'DEBT' && !hasParty && !debtPartyId) return setErr('اختر العميل / المورد لتسجيل الدين');
    returnLoan.mutate(
      {
        id: loan.id,
        dto: {
          returnDate,
          returnType,
          returnedQty: rQtyNum,
          pricePerUnit: returnType !== 'GOODS' ? priceNum : undefined,
          treasuryId: returnType === 'CASH' ? treasuryId : undefined,
          debtPartyId: returnType === 'DEBT' && !hasParty ? debtPartyId : undefined,
          returnNote: returnNote || undefined,
        },
      },
      { onSuccess: () => onClose(), onError: (e: any) => setErr(e.message) },
    );
  };

  return (
    <div className="card" style={{ padding: 16, border: '1.5px solid var(--primary)', background: 'var(--bg-soft)' }}>
      <div style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 14 }}>استرداد من: {borrowerLabel(loan)}</b>
        <span className="muted" style={{ fontSize: 13, marginRight: 8 }}>
          {loan.product.name} — المتبقي: <b style={{ color: 'var(--debit)' }}>{QTY(remaining)} {loan.product.unit || 'وحدة'}</b>
          {(loan.returnedQty > 0 || loan.cashReturnedQty > 0) && (
            <span style={{ fontSize: 11, marginRight: 6 }}>
              (أصل: {QTY(loan.qty)}{loan.returnedQty > 0 ? ' ، رجع: ' + QTY(loan.returnedQty) : ''}{loan.cashReturnedQty > 0 ? ' ، مسوّى: ' + QTY(loan.cashReturnedQty) : ''})
            </span>
          )}
        </span>
      </div>

      {loan.returns.length > 0 && (
        <div style={{ marginBottom: 14, padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--line)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--muted)' }}>سجل الاسترداد</div>
          {loan.returns.map((r) => <ReturnHistoryRow key={r.id} r={r} />)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {RETURN_TYPES.map(({ t, label, desc, color }) => (
          <label key={t} style={{
            display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer',
            fontWeight: returnType === t ? 700 : 400,
            padding: '6px 14px', borderRadius: 6,
            background: returnType === t ? color + '18' : 'transparent',
            border: '1.5px solid ' + (returnType === t ? color : 'var(--line)'),
            color: returnType === t ? color : 'inherit',
          }}>
            <input type="radio" checked={returnType === t} onChange={() => handleTypeChange(t)} style={{ accentColor: color }} />
            {label} <span style={{ fontSize: 11, opacity: 0.7 }}>{desc}</span>
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="تاريخ الرد">
          <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
        </Field>
        <Field label={'الكمية (من ' + QTY(remaining) + ' متبقية)'}>
          <MoneyInput value={returnedQty} onChange={setReturnedQty} placeholder={String(remaining)} style={{ maxWidth: 110 }} />
        </Field>

        {returnType !== 'GOODS' && (
          <Field label="سعر القطعة (ج.م)">
            <MoneyInput value={pricePerUnit} onChange={setPricePerUnit} placeholder="0.00" style={{ maxWidth: 130 }} />
          </Field>
        )}

        {total > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>الإجمالي</span>
            <div style={{
              padding: '10px 16px', borderRadius: 6, fontWeight: 700, fontSize: 16,
              background: returnType === 'DEBT' ? 'var(--debit-bg)' : 'var(--credit-bg)',
              color: returnType === 'DEBT' ? 'var(--debit)' : 'var(--credit)',
              border: '1px solid ' + (returnType === 'DEBT' ? 'var(--debit)' : 'var(--credit)'),
            }}>{EGP(total)}</div>
          </div>
        )}

        {returnType === 'CASH' && (
          <Field label="الخزنة *">
            <div style={{ minWidth: 190 }}>
              <Combobox options={treasury?.data ?? []} value={treasuryId} onChange={setTreasuryId} placeholder="اختر الخزنة…" />
            </div>
          </Field>
        )}

        {returnType === 'DEBT' && !hasParty && (
          <Field label="العميل / المورد *">
            <div style={{ minWidth: 200 }}>
              <Combobox options={allParties} value={debtPartyId} onChange={setDebtPartyId} placeholder="اختر…" />
            </div>
          </Field>
        )}

        {returnType === 'DEBT' && hasParty && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>سيضاف على حساب</span>
            <div style={{ padding: '10px 14px', background: 'var(--debit-bg)', borderRadius: 6, fontWeight: 700, color: 'var(--debit)', fontSize: 14 }}>
              {loan.party!.name}
            </div>
          </div>
        )}

        <Field label="ملاحظة">
          <input value={returnNote} onChange={(e) => setReturnNote(e.target.value)} placeholder="اختياري…" style={{ maxWidth: 200 }} />
        </Field>
      </div>

      {err && <div className="err-text" style={{ marginTop: 8 }}>{err}</div>}
      <div className="toolbar" style={{ marginTop: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={returnLoan.isPending}>
          {returnLoan.isPending ? '...'
            : returnType === 'CASH' && total > 0 ? 'تحصيل ' + EGP(total)
            : returnType === 'DEBT' && total > 0 ? 'تسجيل دين ' + EGP(total)
            : 'تأكيد الرد'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>إلغاء</button>
      </div>
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = { GOODS: 'بضاعة', CASH: 'فلوس', DEBT: 'دين', MIXED: 'مختلط' };
const TYPE_COLOR: Record<string, string> = { GOODS: 'var(--credit)', CASH: '#2563eb', DEBT: 'var(--debit)', MIXED: '#6d28d9' };

function LoanDetailPanel({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const goodsTotal = loan.returns.filter((r) => r.returnType === 'GOODS').reduce((s, r) => s + r.qty, 0);
  const cashTotal  = loan.returns.filter((r) => r.returnType === 'CASH').reduce((s, r) => s + r.qty * (r.pricePerUnit ?? 0), 0);
  const debtTotal  = loan.returns.filter((r) => r.returnType === 'DEBT').reduce((s, r) => s + r.qty * (r.pricePerUnit ?? 0), 0);
  const remaining  = loan.qty - (loan.returnedQty ?? 0) - (loan.cashReturnedQty ?? 0);

  return (
    <div className="card" style={{ padding: 18, marginBottom: 16, border: '1.5px solid var(--line)' }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{borrowerLabel(loan)}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {loan.product.name}{loan.product.unit ? ' (' + loan.product.unit + ')' : ''} — {loan.warehouse.name}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>تاريخ الاستعارة: {fmtDate(loan.date)}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>× إغلاق</button>
      </div>

      {/* summary strip */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { label: 'الأصل', val: QTY(loan.qty) + (loan.product.unit ? ' ' + loan.product.unit : ''), color: 'inherit' },
          { label: 'رجع بضاعة', val: QTY(loan.returnedQty ?? 0), color: 'var(--credit)' },
          { label: 'مسوّى (فلوس/دين)', val: QTY(loan.cashReturnedQty ?? 0), color: '#2563eb' },
          { label: 'متبقي', val: QTY(remaining), color: remaining > 0 ? 'var(--debit)' : 'var(--credit)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ padding: '8px 14px', background: 'var(--bg-soft)', borderRadius: 8, border: '1px solid var(--line)', minWidth: 100 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
            <div style={{ fontWeight: 800, fontSize: 15, color }}>{val}</div>
          </div>
        ))}
        {cashTotal > 0 && (
          <div style={{ padding: '8px 14px', background: 'var(--credit-bg)', borderRadius: 8, border: '1px solid var(--credit)', minWidth: 100 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>إجمالي محصّل</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--credit)' }}>{EGP(cashTotal)}</div>
          </div>
        )}
        {debtTotal > 0 && (
          <div style={{ padding: '8px 14px', background: 'var(--debit-bg)', borderRadius: 8, border: '1px solid var(--debit)', minWidth: 100 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>إجمالي دين</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--debit)' }}>{EGP(debtTotal)}</div>
          </div>
        )}
      </div>

      {/* steps table */}
      {loan.returns.length === 0 ? (
        <div className="muted" style={{ textAlign: 'center', padding: 20, fontSize: 13 }}>لا توجد عمليات استرداد مسجّلة</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>الكمية</th>
                <th>سعر القطعة</th>
                <th>الإجمالي</th>
                <th>ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {loan.returns.map((r, i) => {
                const color = TYPE_COLOR[r.returnType] ?? 'inherit';
                const total = r.pricePerUnit ? r.qty * r.pricePerUnit : null;
                return (
                  <tr key={r.id}>
                    <td className="muted" style={{ fontSize: 12 }}>{i + 1}</td>
                    <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                    <td>
                      <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: color + '18', color }}>
                        {TYPE_LABEL[r.returnType] ?? r.returnType}
                      </span>
                    </td>
                    <td className="num">{QTY(r.qty)}</td>
                    <td className="num">{r.pricePerUnit ? EGP(r.pricePerUnit) : '—'}</td>
                    <td className="num" style={{ fontWeight: 700, color: r.returnType === 'DEBT' ? 'var(--debit)' : r.returnType === 'CASH' ? 'var(--credit)' : 'inherit' }}>
                      {total ? EGP(total) : '—'}
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{r.note ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function LoansView({ defaultWarehouseId }: { defaultWarehouseId?: string }) {
  const { can } = useAuth();
  const { data: warehouses } = useAllWarehouses();
  const [whId, setWhId] = useState(defaultWarehouseId ?? '');
  const [status, setStatus] = useState<'OPEN' | 'RETURNED'>('OPEN');
  const [showCreate, setShowCreate] = useState(false);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const deleteLoan = useDeleteLoan();

  const { data: loans = [], isLoading } = useLoans({ warehouseId: whId || undefined, status });
  const returningLoan = returningId ? loans.find((l) => l.id === returningId) ?? null : null;
  const viewingLoan   = viewingId   ? loans.find((l) => l.id === viewingId)   ?? null : null;

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <div style={{ minWidth: 200 }}>
          <Combobox
            options={[{ id: '', name: 'كل المخازن' }, ...(warehouses?.data ?? [])]}
            value={whId} onChange={setWhId} placeholder="كل المخازن"
          />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['OPEN', 'RETURNED'] as const).map((s) => (
            <button key={s} className={'btn btn-sm ' + (status === s ? 'btn-primary' : 'btn-ghost')}
              onClick={() => { setStatus(s); setReturningId(null); setViewingId(null); }}>
              {s === 'OPEN' ? 'الحالية' : 'المستردة'}
            </button>
          ))}
        </div>
        {can('inventory.loans') && !showCreate && (
          <button className="btn btn-primary btn-sm sp" onClick={() => setShowCreate(true)}>+ عارية جديدة</button>
        )}
      </div>

      {showCreate && <LoanForm defaultWarehouseId={whId} onClose={() => setShowCreate(false)} />}

      {viewingLoan && (
        <LoanDetailPanel loan={viewingLoan} onClose={() => setViewingId(null)} />
      )}

      {returningLoan && (
        <div style={{ marginBottom: 16 }}>
          <ReturnPanel loan={returningLoan} onClose={() => setReturningId(null)} />
        </div>
      )}

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>المستعير</th>
              <th>الصنف</th>
              <th>المتبقي / الأصل</th>
              <th>المخزن</th>
              {status === 'RETURNED' && <><th>تاريخ آخر رد</th><th>نوع الاسترداد</th></>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>جاري التحميل…</td></tr>
            )}
            {!isLoading && loans.length === 0 && (
              <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                لا توجد بضائع مستعارة {status === 'OPEN' ? 'حالية' : 'مستردة'}
              </td></tr>
            )}
            {loans.map((loan) => {
              const rem = loan.qty - (loan.returnedQty ?? 0) - (loan.cashReturnedQty ?? 0);
              const isViewing = viewingId === loan.id;
              const hasReturns = loan.returns.length > 0;
              return (
                <tr
                  key={loan.id}
                  style={{
                    cursor: hasReturns || status === 'RETURNED' ? 'pointer' : 'default',
                    background: isViewing ? 'var(--primary-bg, #f0f4ff)' : returningId === loan.id ? 'var(--bg-soft)' : undefined,
                  }}
                  onClick={() => {
                    if (!hasReturns && status !== 'RETURNED') return;
                    setViewingId(isViewing ? null : loan.id);
                    setReturningId(null);
                  }}
                >
                  <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(loan.date)}</td>
                  <td style={{ fontWeight: 600 }}>
                    {borrowerLabel(loan)}
                    {loan.party && <span className="muted" style={{ fontSize: 11, marginRight: 4 }}>({loan.party.role === 'CLIENT' ? 'عميل' : 'مورد'})</span>}
                  </td>
                  <td>{loan.product.name}</td>
                  <td className="num">
                    {QTY(rem)}{loan.product.unit ? ' ' + loan.product.unit : ''}
                    <span className="muted" style={{ fontSize: 11, display: 'block' }}>أصل: {QTY(loan.qty)}</span>
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{loan.warehouse.name}</td>
                  {status === 'RETURNED' && (
                    <>
                      <td className="muted" style={{ fontSize: 12 }}>{loan.returnDate ? fmtDate(loan.returnDate) : '—'}</td>
                      <td>
                        {loan.returnType && (
                          <span className="pill" style={{ background: (TYPE_COLOR[loan.returnType] ?? 'var(--line)') + '22', color: TYPE_COLOR[loan.returnType] ?? 'inherit' }}>
                            {TYPE_LABEL[loan.returnType] ?? loan.returnType}
                          </span>
                        )}
                      </td>
                    </>
                  )}
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(hasReturns || status === 'RETURNED') && (
                        <button
                          className={'btn btn-sm ' + (isViewing ? 'btn-primary' : 'btn-ghost')}
                          onClick={(e) => { e.stopPropagation(); setViewingId(isViewing ? null : loan.id); setReturningId(null); }}
                        >
                          {isViewing ? '▲ إخفاء' : '▼ تفاصيل'}
                        </button>
                      )}
                      {status === 'OPEN' && can('inventory.loans') && (
                        <button
                          className={'btn btn-sm ' + (returningId === loan.id ? 'btn-ghost' : 'btn-primary')}
                          onClick={(e) => { e.stopPropagation(); setReturningId(returningId === loan.id ? null : loan.id); setViewingId(null); }}
                        >
                          {returningId === loan.id ? 'إلغاء' : 'استرداد'}
                        </button>
                      )}
                      {status === 'OPEN' && can('inventory.loans') && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={(e) => { e.stopPropagation(); if (!window.confirm('حذف هذه العارية؟')) return; deleteLoan.mutate(loan.id); }}
                          disabled={deleteLoan.isPending}
                        >x</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
