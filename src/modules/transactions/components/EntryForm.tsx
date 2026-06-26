'use client';

import { useEffect, useState } from 'react';
import { todayISO, EGP, fmtDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { fieldNavKeyDown } from '@/lib/field-nav';
import { PageTitle, Field, Combobox, MoneyInput } from '@/components/common';
import { PartyCombobox } from '../../invoices/components/PartyCombobox';
import { useAllParties } from '../../parties/hooks';
import { useAllTreasury } from '../../treasury/hooks';
import { useAllExpenseCategories } from '../../expense-categories/hooks';
import { usePostEntry, usePendingCollections, useResolveCollection } from '../hooks';
import { useForexAgents, useEgpInAny } from '../../forex/hooks';
import { usePendingDriverTrips, useAddPayment } from '../../driver-trips/hooks';
import type { EntryType } from '../dtos';

type TabType = EntryType | 'driverPayment';

const TABS: { t: TabType; label: string; perm: string }[] = [
  { t: 'collect', label: 'تحصيل من عميل', perm: 'entry.collect' },
  { t: 'paySupplier', label: 'دفع لمورد', perm: 'entry.pay' },
  { t: 'expense', label: 'مصروف', perm: 'entry.expense' },
  { t: 'transfer', label: 'تحويل بين الخزائن', perm: 'entry.transfer' },
  { t: 'adjust', label: 'تسوية حساب', perm: 'entry.adjust' },
  { t: 'unknownCollect', label: 'تحصيل مجهول', perm: 'entry.unknown' },
  { t: 'partyTransfer', label: 'التحويل إلى وسيط', perm: 'entry.partyTransfer' },
  { t: 'driverPayment', label: 'سائقين', perm: 'entry.driverPayment' },
];

function PendingCollections() {
  const { can } = useAuth();
  const { data: pending = [] } = usePendingCollections();
  const { data: clients } = useAllParties('CLIENT');
  const resolve = useResolveCollection();
  const [sel, setSel] = useState<Record<string, string>>({});
  const [feeEnabled, setFeeEnabled] = useState<Record<string, boolean>>({});
  const [fee, setFee] = useState<Record<string, string>>({});

  // pre-fill fee when pending items load
  useEffect(() => {
    setFeeEnabled((prev) => {
      const next = { ...prev };
      pending.forEach((p) => { if (!(p.id in next)) next[p.id] = true; });
      return next;
    });
    setFee((prev) => {
      const next = { ...prev };
      pending.forEach((p) => { if (!(p.id in next)) next[p.id] = p.expAmt ? String(p.expAmt) : '500'; });
      return next;
    });
  }, [pending]);

  if (!pending.length) return null;

  return (
    <div className="section">
      <h2>حسابات معلّقة <span style={{ color: 'var(--debit)', fontSize: 13 }}>on pending</span></h2>
      <div className="card tbl-wrap combo-table">
        <table>
          <thead><tr><th>التاريخ</th><th>المبلغ</th><th>الخزينة</th><th>البيان</th><th>صاحبها</th><th></th></tr></thead>
          <tbody>
            {pending.map((p) => (
              <tr key={p.id}>
                <td>{fmtDate(p.date)}</td>
                <td className="num">{EGP(p.cashIn)}</td>
                <td className="muted">{p.treasury?.name ?? '—'}</td>
                <td className="muted">{p.note || '—'} <span style={{ color: 'var(--debit)', fontWeight: 700 }}>on pending</span></td>
                <td style={{ minWidth: 180 }}>
                  <Combobox options={clients?.data ?? []} value={sel[p.id] || ''} onChange={(id) => setSel((s) => ({ ...s, [p.id]: id }))} placeholder="اختر العميل" />
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={feeEnabled[p.id] ?? true} onChange={(e) => setFeeEnabled((f) => ({ ...f, [p.id]: e.target.checked }))} />
                      رسوم نقل
                    </label>
                    {feeEnabled[p.id] && (
                      <MoneyInput value={fee[p.id] ?? ''} onChange={(v) => setFee((f) => ({ ...f, [p.id]: v }))} placeholder="500" style={{ width: 90 }} />
                    )}
                    {can('entry.resolve') && (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={!sel[p.id] || resolve.isPending}
                        onClick={() => resolve.mutate({
                          id: p.id,
                          partyId: sel[p.id],
                          transferFee: feeEnabled[p.id] && fee[p.id] ? Number(fee[p.id]) : undefined,
                        })}
                      >
                        ترحيل لحسابه
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DriverPaymentSection() {
  const { data: trips = [] } = usePendingDriverTrips();
  const { data: treasury } = useAllTreasury();
  const addPayment = useAddPayment();

  const [date, setDate] = useState(todayISO());
  const [tripId, setTripId] = useState('');
  const [payType, setPayType] = useState<'freight' | 'delay'>('freight');
  const [amount, setAmount] = useState('');
  const [weightDiff, setWeightDiff] = useState('');
  const [treasuryId, setTreasuryId] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const selTrip = trips.find((t) => t.id === tripId);
  const remainingFreight = selTrip?.remainingFreight ?? 0;
  const remainingDelay   = selTrip?.remainingDelay   ?? 0;
  const canFreight = remainingFreight > 0;
  const canDelay   = remainingDelay   > 0;

  useEffect(() => {
    if (selTrip) {
      if (payType === 'freight' && !canFreight && canDelay) setPayType('delay');
      if (payType === 'delay'   && !canDelay   && canFreight) setPayType('freight');
      setAmount(String(payType === 'freight' ? remainingFreight : remainingDelay));
    }
  }, [tripId, payType]);

  const reset = () => { setTripId(''); setAmount(''); setWeightDiff(''); setNote(''); setTreasuryId(''); setMsg(''); };

  const maxAmount = payType === 'freight' ? remainingFreight : remainingDelay;

  const submit = () => {
    setError(''); setMsg('');
    if (!tripId) return setError('اختر السائق');
    if (!amount || Number(amount) <= 0) return setError('اكتب المبلغ');
    if (payType === 'freight' && Number(amount) > remainingFreight + 0.001)
      return setError(`المبلغ أكبر من الناولون المتبقي (${EGP(remainingFreight)})`);
    if (payType === 'delay' && Number(amount) > remainingDelay + 0.001)
      return setError(`المبلغ أكبر من العطلة المتبقية (${EGP(remainingDelay)})`);
    if (!treasuryId) return setError('اختر الخزنة');
    addPayment.mutate(
      {
        id: tripId,
        dto: {
          date, amount: Number(amount), paymentType: payType, treasuryId,
          weightDiffAmount: payType === 'delay' && Number(weightDiff) > 0 ? Number(weightDiff) : undefined,
          note: note || undefined,
        },
      },
      {
        onSuccess: () => { setMsg('تم تسجيل الدفعة ✓'); reset(); },
        onError: (e: any) => setError(e.message),
      },
    );
  };

  return (
    <div className="form-grid">
      <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>

      <Field label="السائق / الرحلة" full>
        <select value={tripId} onChange={(e) => { setTripId(e.target.value); setAmount(''); }} style={{ width: '100%' }}>
          <option value="">— اختر السائق —</option>
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.driverName}{t.vehicleNo ? ` (${t.vehicleNo})` : ''} — {t.clientName}
              {(t.remainingFreight ?? 0) > 0 ? ` · ناولون: ${EGP(t.remainingFreight ?? 0)}` : ''}
              {(t.remainingDelay ?? 0) > 0   ? ` · عطلة: ${EGP(t.remainingDelay ?? 0)}` : ''}
            </option>
          ))}
        </select>
        {trips.length === 0 && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>لا توجد رحلات بها رصيد متبقي</div>}
      </Field>

      {selTrip && (
        <>
          <Field label="نوع الدفع">
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="radio" name="dpType" value="freight" checked={payType === 'freight'} disabled={!canFreight}
                  onChange={() => { setPayType('freight'); setAmount(String(remainingFreight)); }} />
                ناولون {canFreight ? <span className="muted" style={{ fontSize: 12 }}>({EGP(remainingFreight)} متبقي)</span> : <span style={{ color: 'var(--muted)', fontSize: 11 }}>(سُدّد)</span>}
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="radio" name="dpType" value="delay" checked={payType === 'delay'} disabled={!canDelay}
                  onChange={() => { setPayType('delay'); setAmount(String(remainingDelay)); }} />
                عطلة {canDelay ? <span className="muted" style={{ fontSize: 12 }}>({EGP(remainingDelay)} متبقي)</span> : <span style={{ color: 'var(--muted)', fontSize: 11 }}>{selTrip.delayFee > 0 ? '(سُدّدت)' : '(لا يوجد)'}</span>}
              </label>
            </div>
          </Field>

          <Field label={`المبلغ (أقصى ${EGP(maxAmount)})`}>
            <MoneyInput
              value={amount}
              onChange={(v) => {
                const cap = payType === 'freight' ? remainingFreight : remainingDelay;
                setAmount(Number(v) > cap ? String(cap) : v);
              }}
              placeholder="0.00"
            />
          </Field>

          {payType === 'delay' && (
            <Field label="فرق وزن (اختياري)">
              <MoneyInput value={weightDiff} onChange={setWeightDiff} placeholder="0.00" />
            </Field>
          )}
        </>
      )}

      <Field label="الخزنة">
        <Combobox options={treasury?.data ?? []} value={treasuryId} onChange={setTreasuryId} />
      </Field>

      <Field label="البيان" full><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" /></Field>

      <div style={{ gridColumn: '1/-1' }}>
        {error && <div className="err-text">{error}</div>}
        {msg && <div style={{ color: 'var(--credit)', fontWeight: 700 }}>{msg}</div>}
        <div className="toolbar" style={{ marginTop: 8, padding: 0 }}>
          <button className="btn btn-primary" onClick={submit} disabled={addPayment.isPending}>تسجيل الدفعة</button>
        </div>
      </div>
    </div>
  );
}

export function EntryForm() {
  const { can } = useAuth();
  const allowedTabs = TABS.filter((tb) => can(tb.perm));
  const [type, setType] = useState<TabType>('collect');
  useEffect(() => {
    if (allowedTabs.length && !allowedTabs.some((tb) => tb.t === type)) setType(allowedTabs[0].t as TabType);
  }, [allowedTabs, type]);
  const { data: clients } = useAllParties('CLIENT');
  const { data: suppliers } = useAllParties('SUPPLIER');
  const { data: treasury } = useAllTreasury();
  const { data: cats } = useAllExpenseCategories();
  const { data: forexAgents } = useForexAgents();
  const postEntry = usePostEntry();
  const egpInMutation = useEgpInAny();
  const [forexAgentId, setForexAgentId] = useState('');

  const [date, setDate] = useState(todayISO());
  const [partyId, setPartyId] = useState('');
  const [partyId2, setPartyId2] = useState('');
  const [treasuryId, setTreasuryId] = useState('');
  const [treasuryId2, setTreasuryId2] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'debit' | 'credit'>('debit');
  const [rate, setRate] = useState('');
  const [addFee, setAddFee] = useState(false);
  const [feeAmount, setFeeAmount] = useState('500');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');


  const parties = type === 'collect' ? clients?.data ?? [] : suppliers?.data ?? [];
  const treasuryCur = (treasury?.data.find((t) => t.id === treasuryId) as any)?.currency;
  const treasury2Cur = (treasury?.data.find((t) => t.id === treasuryId2) as any)?.currency;
  const selParty = type === 'collect' ? clients?.data.find((c) => c.id === partyId) : type === 'paySupplier' ? suppliers?.data.find((s) => s.id === partyId) : undefined;
  const selPartyCur = (selParty as any)?.currency;
  const usdPay = (type === 'collect' || type === 'paySupplier') && (selPartyCur === 'USD' || treasuryCur === 'USD');
  const usdResult = usdPay && Number(rate) > 0 && Number(amount) > 0 ? Number(amount) / Number(rate) : undefined;
  const diffCur = type === 'transfer' && !!treasuryCur && !!treasury2Cur && treasuryCur !== treasury2Cur;
  const received = diffCur && Number(rate) > 0
    ? (treasuryCur === 'EGP' ? Number(amount) / Number(rate) : Number(amount) * Number(rate))
    : undefined;

  const reset = () => {
    setAmount(''); setNote(''); setPartyId(''); setPartyId2('');
    setTreasuryId(''); setTreasuryId2(''); setCategoryId('');
    setRate(''); setAddFee(false); setFeeAmount('500'); setForexAgentId('');
  };

  const submit = () => {
    setError(''); setMsg('');

    if (type === 'partyTransfer') {
      if (!forexAgentId) return setError('اختر الوكيل');
      if (!amount || Number(amount) <= 0) return setError('اكتب المبلغ');
      egpInMutation.mutate(
        { agentUid: forexAgentId, dto: { date, egpAmount: Number(amount), treasuryId: treasuryId || undefined, note: note || undefined } },
        {
          onSuccess: () => { setMsg('تم التحويل إلى الوكيل ✓'); reset(); },
          onError: (e: any) => setError(e.message),
        },
      );
      return;
    }

    postEntry.mutate(
      {
        type: type as EntryType, date, amount: Number(amount),
        partyId: ['collect', 'paySupplier', 'adjust'].includes(type) ? partyId : undefined,
        treasuryId: type !== 'adjust' ? treasuryId : undefined,
        treasuryId2: type === 'transfer' ? treasuryId2 : undefined,
        categoryId: type === 'expense' ? categoryId : undefined,
        direction: type === 'adjust' ? direction : undefined,
        rate: usdPay ? Number(rate) || undefined : undefined,
        amount2: type === 'transfer' && received ? received : undefined,
        transferFee: (type === 'collect' || type === 'unknownCollect') && addFee ? Number(feeAmount) || undefined : undefined,
        note: note || undefined,
      },
      {
        onSuccess: () => { setMsg('تم تسجيل الحركة ✓'); reset(); },
        onError: (e: any) => setError(e.message),
      },
    );
  };

  return (
    <>
      <PageTitle title="الإدخال اليومي" subtitle="التحصيل، الدفع للموردين، المصاريف، التحويلات وتسوية الحسابات" />
      <div className="card" onKeyDown={fieldNavKeyDown}>
        <div className="toolbar" style={{ padding: 14 }}>
          {allowedTabs.map((tb) => (
            <button key={tb.t} className={`btn btn-sm ${type === tb.t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setType(tb.t)}>{tb.label}</button>
          ))}
        </div>

        {type === 'driverPayment' ? (
          <div style={{ padding: '0 16px 16px' }}>
            <DriverPaymentSection />
          </div>
        ) : (
          <>
            <div className="form-grid">
              <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>

              {(type === 'collect' || type === 'paySupplier' || type === 'adjust') && (
                <Field label={type === 'collect' ? 'العميل' : type === 'paySupplier' ? 'المورد' : 'الحساب'}>
                  <PartyCombobox
                    parties={type === 'adjust' ? [...(clients?.data ?? []), ...(suppliers?.data ?? [])] : parties}
                    value={partyId}
                    onChange={setPartyId}
                    role={type === 'paySupplier' ? 'SUPPLIER' : 'CLIENT'}
                  />
                </Field>
              )}

              {type === 'partyTransfer' && (
                <Field label="الوكيل">
                  <select value={forexAgentId} onChange={(e) => setForexAgentId(e.target.value)}>
                    <option value="">— اختر الوكيل —</option>
                    {(forexAgents ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </Field>
              )}

              {type === 'expense' && (
                <Field label="بند المصروف">
                  <Combobox options={cats?.data ?? []} value={categoryId} onChange={setCategoryId} />
                </Field>
              )}

              {type !== 'adjust' && (
                <Field label={type === 'transfer' ? 'من حساب' : type === 'partyTransfer' ? 'من خزنة' : 'حساب الخزنة'}>
                  <Combobox options={treasury?.data ?? []} value={treasuryId} onChange={setTreasuryId} placeholder={type === 'partyTransfer' ? 'اختياري…' : undefined} />
                </Field>
              )}

              {type === 'transfer' && (
                <Field label="إلى حساب">
                  <Combobox options={treasury?.data ?? []} value={treasuryId2} onChange={setTreasuryId2} />
                </Field>
              )}

              {diffCur && (
                <Field label={`سعر الدولار${received ? ` (= ${received.toFixed(2)} ${treasury2Cur})` : ''}`}>
                  <MoneyInput value={rate} onChange={setRate} placeholder="مثلاً 50" />
                </Field>
              )}

              {type === 'adjust' && (
                <Field label="اتجاه التسوية">
                  <select value={direction} onChange={(e) => setDirection(e.target.value as 'debit' | 'credit')}>
                    <option value="debit">مدين (يزيد المستحق عليه)</option>
                    <option value="credit">دائن (يقلل المستحق عليه)</option>
                  </select>
                </Field>
              )}

              <Field label={usdPay ? `المبلغ (مصري) + سعر الدولار${usdResult ? ` = ${usdResult.toFixed(2)} $` : ''}` : diffCur ? `المبلغ (${treasuryCur})` : 'المبلغ'}>
                {usdPay ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <MoneyInput value={amount} onChange={setAmount} placeholder="بالمصري" />
                    <MoneyInput value={rate} onChange={setRate} placeholder="سعر $" style={{ width: 80 }} />
                  </div>
                ) : (
                  <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
                )}
              </Field>
              <Field label="البيان" full><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            </div>
            {(type === 'collect' || type === 'unknownCollect') && (
              <div style={{ padding: '0 16px 8px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
                  <input type="checkbox" checked={addFee} onChange={(e) => setAddFee(e.target.checked)} /> إضافة رسوم نقل النقدية {type === 'unknownCollect' ? '(تتسجّل على العميل وقت الترحيل)' : '(تُسجّل على العميل)'}
                </label>
                {addFee && <MoneyInput value={feeAmount} onChange={setFeeAmount} placeholder="500" style={{ width: 120 }} />}
              </div>
            )}
            <div className="err-text" style={{ padding: '0 16px' }}>{error}</div>
            {msg && <div style={{ padding: '0 16px', color: 'var(--credit)', fontWeight: 700 }}>{msg}</div>}
            <div className="toolbar" style={{ padding: 16 }}>
              <button className="btn btn-primary" onClick={submit} disabled={postEntry.isPending}>تسجيل الحركة</button>
            </div>
          </>
        )}
      </div>

      <PendingCollections />
    </>
  );
}
