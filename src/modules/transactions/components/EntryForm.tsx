'use client';

import { useEffect, useState } from 'react';
import { todayISO, EGP, fmtDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { fieldNavKeyDown } from '@/lib/field-nav';
import { PageTitle, Field, Combobox, MoneyInput } from '@/components/common';
import { PartyCombobox } from '../../invoices/components/PartyCombobox';
import { useAllParties } from '../../parties/hooks';
import { useAllTreasury, useTreasuryNames } from '../../treasury/hooks';
import { useAllWarehouses } from '../../warehouses/hooks';
import { useAllExpenseCategories } from '../../expense-categories/hooks';
import { ExpenseCategoriesManager } from '../../expense-categories/components/ExpenseCategoriesManager';
import { WarehouseSchedulesManager } from '../../warehouse-expenses/components/WarehouseSchedulesManager';
import { GoodsCostPicker } from './GoodsCostPicker';
import type { CashDir, CashTarget, GoodsMode, GoodsItem } from '../dtos';
import { usePostEntry, usePendingCollections, useResolveCollection } from '../hooks';
import { useForexAgents, useEgpInAny } from '../../forex/hooks';
import { usePendingDriverTrips, useAddPayment } from '../../driver-trips/hooks';
import type { EntryType } from '../dtos';

type TabType = EntryType | 'driverPayment' | 'balanceTransfer';

const TABS: { t: TabType; label: string; perm: string }[] = [
  { t: 'collect', label: 'تحصيل من عميل', perm: 'entry.collect' },
  { t: 'paySupplier', label: 'دفع لمورد', perm: 'entry.pay' },
  { t: 'cash', label: 'صرف وتوريد نقدية', perm: 'entry.expense' },
  { t: 'transfer', label: 'تحويل بين الخزائن', perm: 'entry.transfer' },
  { t: 'balanceTransfer', label: 'تحويل بين الأطراف', perm: 'entry.partyTransfer' },
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
      <div className="card" style={{ overflow: 'hidden' }}>
        {pending.map((p, i) => (
          <div key={p.id} style={{ padding: '14px 16px', borderBottom: i < pending.length - 1 ? '1px solid var(--line-soft)' : 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* meta row: date + amount + treasury */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700 }}>{fmtDate(p.date)}</span>
              <span className="num" style={{ color: 'var(--credit)', fontWeight: 700 }}>{EGP(p.cashIn)}</span>
              {p.treasury?.name && <span className="muted" style={{ fontSize: 13 }}>{p.treasury.name}</span>}
              {p.note && <span className="muted" style={{ fontSize: 13 }}>{p.note} <span style={{ color: 'var(--debit)', fontWeight: 700 }}>on pending</span></span>}
            </div>
            {/* client picker */}
            <div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 700, marginBottom: 4 }}>صاحبها</div>
              <Combobox options={clients?.data ?? []} value={sel[p.id] || ''} onChange={(id) => setSel((s) => ({ ...s, [p.id]: id }))} placeholder="اختر العميل" />
            </div>
            {/* actions */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontWeight: 600 }}>
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
          </div>
        ))}
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
  const [payType, setPayType] = useState<'freight' | 'delay' | 'weightDiff' | 'advance'>('freight');
  const [amount, setAmount] = useState('');
  const [treasuryId, setTreasuryId] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const selTrip = trips.find((t) => t.id === tripId);
  const remainingFreight    = selTrip?.remainingFreight    ?? 0;
  const remainingDelay      = selTrip?.remainingDelay      ?? 0;
  const remainingWeightDiff = selTrip?.remainingWeightDiff ?? 0;
  const canFreight    = remainingFreight    > 0;
  const canDelay      = remainingDelay      > 0;
  const canWeightDiff = remainingWeightDiff > 0;

  useEffect(() => {
    if (selTrip) {
      if (payType === 'freight'    && !canFreight    && canDelay)      setPayType('delay');
      if (payType === 'freight'    && !canFreight    && canWeightDiff) setPayType('weightDiff');
      if (payType === 'delay'      && !canDelay      && canFreight)    setPayType('freight');
      if (payType === 'weightDiff' && !canWeightDiff && canFreight)    setPayType('freight');
      // الأنواع المحدودة تتعبّى بالمتبقي؛ السلفة حرة (من غير سقف) فتُترك فاضية للكتابة.
      setAmount(payType === 'freight' ? String(remainingFreight) : payType === 'delay' ? String(remainingDelay) : payType === 'weightDiff' ? String(remainingWeightDiff) : '');
    }
  }, [tripId, payType]);

  const reset = () => { setTripId(''); setAmount(''); setNote(''); setTreasuryId(''); setMsg(''); };

  const maxAmount = payType === 'freight' ? remainingFreight : payType === 'delay' ? remainingDelay : payType === 'weightDiff' ? remainingWeightDiff : Infinity;

  const submit = () => {
    setError(''); setMsg('');
    if (!tripId) return setError('اختر السائق');
    if (!amount || Number(amount) <= 0) return setError('اكتب المبلغ');
    if (payType === 'freight'    && Number(amount) > remainingFreight    + 0.001) return setError(`المبلغ أكبر من الناولون المتبقي (${EGP(remainingFreight)})`);
    if (payType === 'delay'      && Number(amount) > remainingDelay      + 0.001) return setError(`المبلغ أكبر من العطلة المتبقية (${EGP(remainingDelay)})`);
    if (payType === 'weightDiff' && Number(amount) > remainingWeightDiff + 0.001) return setError(`المبلغ أكبر من فرق الوزن المتبقي (${EGP(remainingWeightDiff)})`);
    if (!treasuryId) return setError('اختر الخزنة');
    addPayment.mutate(
      { id: tripId, dto: { date, amount: Number(amount), paymentType: payType, treasuryId, note: note || undefined } },
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
              {(t.remainingFreight    ?? 0) > 0 ? ` · ناولون: ${EGP(t.remainingFreight    ?? 0)}` : ''}
              {(t.remainingDelay      ?? 0) > 0 ? ` · عطلة: ${EGP(t.remainingDelay      ?? 0)}` : ''}
              {(t.remainingWeightDiff ?? 0) > 0 ? ` · فرق وزن: ${EGP(t.remainingWeightDiff ?? 0)}` : ''}
            </option>
          ))}
        </select>
        {trips.length === 0 && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>لا توجد رحلات بها رصيد متبقي</div>}
      </Field>

      {selTrip && (
        <>
          <Field label="نوع الدفع">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="radio" name="dpType" value="weightDiff" checked={payType === 'weightDiff'} disabled={!canWeightDiff}
                  onChange={() => { setPayType('weightDiff'); setAmount(String(remainingWeightDiff)); }} />
                فرق وزن {canWeightDiff ? <span className="muted" style={{ fontSize: 12 }}>({EGP(remainingWeightDiff)} متبقي)</span> : <span style={{ color: 'var(--muted)', fontSize: 11 }}>{(selTrip.weightDiffAmount ?? 0) > 0 ? '(سُدّد)' : '(لا يوجد)'}</span>}
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="radio" name="dpType" value="advance" checked={payType === 'advance'}
                  onChange={() => { setPayType('advance'); setAmount(''); }} />
                سلفة <span className="muted" style={{ fontSize: 12 }}>(تُخصم من العطلة)</span>
              </label>
            </div>
          </Field>

          <Field label={payType === 'advance' ? 'المبلغ (سلفة)' : `المبلغ (أقصى ${EGP(maxAmount)})`}>
            <MoneyInput
              value={amount}
              onChange={(v) => { setAmount(Number(v) > maxAmount ? String(maxAmount) : v); }}
              placeholder="0.00"
            />
          </Field>
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
  const { can, user } = useAuth();
  const allowedTabs = TABS.filter((tb) => can(tb.perm));
  const [type, setType] = useState<TabType>('collect');
  useEffect(() => {
    if (allowedTabs.length && !allowedTabs.some((tb) => tb.t === type)) setType(allowedTabs[0].t as TabType);
  }, [allowedTabs, type]);
  const { data: clients } = useAllParties('CLIENT');
  const { data: suppliers } = useAllParties('SUPPLIER');
  const { data: agents } = useAllParties('AGENT');
  const { data: persons } = useAllParties('PERSON');
  const { data: treasury } = useAllTreasury();
  const { data: treasuryNames } = useTreasuryNames(); // كل الخزائن (وجهة التحويل لأي خزينة)
  const { data: warehouses } = useAllWarehouses();
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
  const [warehouseId, setWarehouseId] = useState('');
  const [cashDir, setCashDir] = useState<CashDir>('out');
  const [cashTarget, setCashTarget] = useState<CashTarget>('warehouse');
  const [goodsMode, setGoodsMode] = useState<GoodsMode>('invoices');
  const [invoiceIds, setInvoiceIds] = useState<string[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItem[]>([]);
  const [holderName, setHolderName] = useState('');
  // وجهة تسوية العهدة عند التوريد: خزنة (رد كاش) / عميل (يتحمّلها) / بند (مصروف)
  const [custodyDest, setCustodyDest] = useState<'treasury' | 'client' | 'category'>('treasury');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'debit' | 'credit'>('debit');
  const [rate, setRate] = useState('');
  const [addFee, setAddFee] = useState(false);
  const [feeAmount, setFeeAmount] = useState('500');
  const [expensePartyId, setExpensePartyId] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');


  const parties = type === 'collect' ? clients?.data ?? [] : suppliers?.data ?? [];
  // Every party (client + supplier + agent) — for the ledger-only party-to-party transfer.
  const allParties = [...(clients?.data ?? []), ...(suppliers?.data ?? []), ...(agents?.data ?? [])];
  const treasuryCur = (treasury?.data.find((t) => t.id === treasuryId) as any)?.currency;
  const treasury2Cur = (treasuryNames?.find((t) => t.id === treasuryId2) as any)?.currency;
  const selParty = type === 'collect' ? clients?.data.find((c) => c.id === partyId) : type === 'paySupplier' ? suppliers?.data.find((s) => s.id === partyId) : undefined;
  // الطرف المختار حسب نوع الحركة/الجهة — عشان نظهر رصيده الحالي وانا بعمل المعاملة.
  const activeParty =
    type === 'collect' ? clients?.data.find((c) => c.id === partyId)
    : type === 'paySupplier' ? suppliers?.data.find((s) => s.id === partyId)
    : type === 'adjust' ? allParties.find((p) => p.id === partyId)
    : type === 'cash' && cashTarget === 'client' ? clients?.data.find((c) => c.id === partyId)
    : type === 'cash' && cashTarget === 'supplier' ? suppliers?.data.find((s) => s.id === partyId)
    : type === 'cash' && cashTarget === 'account' ? allParties.find((p) => p.id === partyId)
    : type === 'cash' && cashTarget === 'custody' ? persons?.data.find((p) => p.name === holderName.trim())
    : undefined;
  const selPartyCur = (selParty as any)?.currency;
  const usdPay = (type === 'collect' || type === 'paySupplier') && (selPartyCur === 'USD' || treasuryCur === 'USD');
  const usdResult = usdPay && Number(rate) > 0 && Number(amount) > 0 ? Number(amount) / Number(rate) : undefined;
  const diffCur = type === 'transfer' && !!treasuryCur && !!treasury2Cur && treasuryCur !== treasury2Cur;
  const received = diffCur && Number(rate) > 0
    ? (treasuryCur === 'EGP' ? Number(amount) / Number(rate) : Number(amount) * Number(rate))
    : undefined;

  const reset = () => {
    setAmount(''); setNote(''); setPartyId(''); setPartyId2('');
    setTreasuryId(''); setTreasuryId2(''); setCategoryId(''); setWarehouseId('');
    setRate(''); setAddFee(false); setFeeAmount('500'); setForexAgentId(''); setExpensePartyId('');
    setInvoiceIds([]); setGoodsItems([]); setHolderName('');
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

    // Ledger-only transfer between any two parties (client↔supplier↔client) — moves the
    // balance from one party to another without touching a treasury.
    if (type === 'balanceTransfer') {
      if (!partyId) return setError('اختر الطرف المُحوِّل (من)');
      if (!partyId2) return setError('اختر الطرف المستلم (إلى)');
      if (partyId === partyId2) return setError('لا يمكن التحويل لنفس الطرف');
      if (!amount || Number(amount) <= 0) return setError('اكتب المبلغ');
      postEntry.mutate(
        { type: 'partyTransfer', date, amount: Number(amount), partyId, partyId2, note: note || undefined },
        {
          onSuccess: () => { setMsg('تم التحويل بين الأطراف ✓'); reset(); },
          onError: (e: any) => setError(e.message),
        },
      );
      return;
    }

    // صرف وتوريد نقدية موحّد بجهة
    if (type === 'cash') {
      if (!amount || Number(amount) <= 0) return setError('اكتب المبلغ');
      // تسوية العهدة لعميل/بند مالهاش خزنة (الكاش خرج وقت صرف العهدة).
      const custodySettleClient = cashTarget === 'custody' && cashDir === 'in' && custodyDest === 'client';
      const custodySettleCategory = cashTarget === 'custody' && cashDir === 'in' && custodyDest === 'category';
      const needsTreasury = cashTarget !== 'account' && !custodySettleClient && !custodySettleCategory;
      if (needsTreasury && !treasuryId) return setError('اختر الخزنة');
      if ((cashTarget === 'client' || cashTarget === 'supplier') && !partyId) return setError(cashTarget === 'client' ? 'اختر العميل' : 'اختر المورد');
      if (cashTarget === 'account' && !partyId) return setError('اختر الحساب');
      if (cashTarget === 'custody' && !holderName.trim()) return setError('اكتب اسم صاحب العهدة');
      if (custodySettleClient && !partyId) return setError('اختر العميل اللي هتتحوّل عليه العهدة');
      if (custodySettleCategory && !categoryId) return setError('اختر بند المصروف');
      if (cashTarget === 'warehouse' && !warehouseId) return setError('اختر المخزن');
      if (cashTarget === 'external' && !categoryId) return setError('اختر بند المصروف الخارجي');
      postEntry.mutate(
        {
          type: 'cash', date, amount: Number(amount),
          cashDir, cashTarget,
          treasuryId: needsTreasury ? treasuryId : undefined,
          partyId: (cashTarget === 'client' || cashTarget === 'supplier' || cashTarget === 'account' || custodySettleClient) ? partyId : undefined,
          holderName: cashTarget === 'custody' ? holderName.trim() : undefined,
          custodyDest: cashTarget === 'custody' && cashDir === 'in' ? custodyDest : undefined,
          warehouseId: (cashTarget === 'warehouse' || cashTarget === 'goods') ? warehouseId || undefined : undefined,
          categoryId: (cashTarget === 'warehouse' || cashTarget === 'external' || custodySettleCategory) ? categoryId || undefined : undefined,
          ...(cashTarget === 'goods' ? {
            goodsMode,
            invoiceIds: goodsMode === 'invoices' ? invoiceIds : undefined,
            goodsItems: goodsMode !== 'invoices' ? goodsItems.filter((g) => g.productId) : undefined,
          } : {}),
          note: note || undefined,
        },
        {
          onSuccess: () => { setMsg('تم تسجيل الحركة ✓'); reset(); },
          onError: (e: any) => setError(e.message),
        },
      );
      return;
    }

    // تحقّق قبل الإرسال للأنواع اللي مكانتش بتتحقّق (تحصيل/دفع لمورد/تحويل/تحصيل مجهول/تسوية)
    if (!amount || Number(amount) <= 0) return setError('اكتب المبلغ');
    if (type === 'collect') {
      if (!partyId) return setError('اختر العميل');
      if (!treasuryId) return setError('اختر الخزنة');
    }
    if (type === 'unknownCollect') {
      if (!treasuryId) return setError('اختر الخزنة');
    }
    if (type === 'paySupplier') {
      if (!partyId) return setError('اختر المورد');
      if (!treasuryId) return setError('اختر الخزنة');
    }
    if (type === 'transfer') {
      if (!treasuryId) return setError('اختر الخزنة المُحوِّل منها');
      if (!treasuryId2) return setError('اختر الخزنة المُحوَّل إليها');
      if (treasuryId === treasuryId2) return setError('لا يمكن التحويل لنفس الخزنة');
      if (diffCur && !(Number(rate) > 0)) return setError('اكتب سعر الدولار للتحويل بين عملتين مختلفتين');
    }
    if (type === 'adjust') {
      if (!partyId) return setError('اختر الحساب');
    }

    postEntry.mutate(
      {
        type: type as EntryType, date, amount: Number(amount),
        partyId: type === 'expense' ? expensePartyId || undefined : ['collect', 'paySupplier', 'adjust'].includes(type) ? partyId : undefined,
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
        onSuccess: () => {
          // notification صغير للخزنة اللي اتحوّلها المبلغ
          if (type === 'transfer') {
            const dest = treasuryNames?.find((t) => t.id === treasuryId2)?.name;
            setMsg(dest ? `✓ اتحوّل ${EGP(Number(amount))} لخزنة ${dest}` : 'تم التحويل ✓');
          } else {
            setMsg('تم تسجيل الحركة ✓');
          }
          reset();
        },
        onError: (e: any) => setError(e.message),
      },
    );
  };

  return (
    <>
      <PageTitle title="الإدخال اليومي" subtitle="التحصيل، الدفع للموردين، المصاريف، التحويلات وتسوية الحسابات" />
      <div className="card" onKeyDown={fieldNavKeyDown}>
        <div className="toolbar entry-tabs" style={{ padding: 14 }}>
          {allowedTabs.map((tb) => (
            <button key={tb.t} className={`btn btn-sm ${type === tb.t ? 'btn-primary' : 'btn-ghost'}`} style={{ whiteSpace: 'nowrap' }} onClick={() => setType(tb.t)}>{tb.label}</button>
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

              {type === 'cash' && (
                <>
                  <Field label="نوع الحركة">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className={`btn btn-sm ${cashDir === 'out' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCashDir('out')}>{cashTarget === 'account' ? 'عليه (يزيد المستحق عليه)' : 'صرف (خروج نقدية)'}</button>
                      <button type="button" className={`btn btn-sm ${cashDir === 'in' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCashDir('in')}>{cashTarget === 'account' ? 'له (يقلل المستحق عليه)' : 'توريد (دخول نقدية)'}</button>
                    </div>
                  </Field>

                  <Field label="الجهة">
                    <select value={cashTarget} onChange={(e) => { setCashTarget(e.target.value as CashTarget); setPartyId(''); setWarehouseId(''); setCategoryId(''); setHolderName(''); setCustodyDest('treasury'); }}>
                      <option value="client">عميل</option>
                      <option value="supplier">مورد</option>
                      <option value="warehouse">مصاريف مخزن</option>
                      <option value="external">مصاريف خارجية</option>
                      <option value="goods">بضاعة</option>
                      <option value="custody">عهدة</option>
                      <option value="account">تسوية حساب</option>
                      <option value="settlement">تسوية نقدية</option>
                    </select>
                  </Field>

                  {cashTarget === 'custody' && (
                    <Field label="صاحب العهدة (أي شخص)">
                      <input
                        value={holderName}
                        onChange={(e) => setHolderName(e.target.value)}
                        placeholder="اكتب الاسم…"
                        list="custody-holders"
                      />
                      <datalist id="custody-holders">
                        {(persons?.data ?? []).map((p) => <option key={p.id} value={p.name} />)}
                      </datalist>
                    </Field>
                  )}

                  {/* تسوية العهدة عند التوريد: سداد لخزنة / تحويل لعميل / تحويل لبند مصروف */}
                  {cashTarget === 'custody' && cashDir === 'in' && (
                    <Field label="وجهة التسوية">
                      <select value={custodyDest} onChange={(e) => { setCustodyDest(e.target.value as any); setPartyId(''); setCategoryId(''); }}>
                        <option value="treasury">سداد لخزنة (رد كاش)</option>
                        <option value="client">تحويل لعميل (يتحمّلها)</option>
                        <option value="category">تحويل لبند مصروف</option>
                      </select>
                    </Field>
                  )}

                  {cashTarget === 'custody' && cashDir === 'in' && custodyDest === 'client' && (
                    <Field label="العميل (هيتحمّل العهدة)">
                      <PartyCombobox parties={clients?.data ?? []} value={partyId} onChange={setPartyId} role="CLIENT" />
                    </Field>
                  )}

                  {cashTarget === 'custody' && cashDir === 'in' && custodyDest === 'category' && (
                    <Field label="بند المصروف" full>
                      <Combobox options={cats?.data ?? []} value={categoryId} onChange={setCategoryId} placeholder="اختر البند" />
                      <div style={{ marginTop: 8 }}>
                        <ExpenseCategoriesManager canManage addOnly />
                      </div>
                    </Field>
                  )}

                  {(cashTarget === 'client' || cashTarget === 'supplier') && (
                    <Field label={cashTarget === 'client' ? 'العميل' : 'المورد'}>
                      <PartyCombobox
                        parties={cashTarget === 'client' ? (clients?.data ?? []) : (suppliers?.data ?? [])}
                        value={partyId}
                        onChange={setPartyId}
                        role={cashTarget === 'supplier' ? 'SUPPLIER' : 'CLIENT'}
                      />
                    </Field>
                  )}

                  {cashTarget === 'account' && (
                    <Field label="الحساب">
                      <PartyCombobox parties={allParties} value={partyId} onChange={setPartyId} role="CLIENT" />
                    </Field>
                  )}

                  {(cashTarget === 'warehouse' || cashTarget === 'goods') && (
                    <Field label={cashTarget === 'warehouse' ? 'المخزن' : 'المخزن (اختياري)'}>
                      <Combobox options={warehouses?.data ?? []} value={warehouseId} onChange={setWarehouseId} placeholder={cashTarget === 'goods' ? 'اختياري' : undefined} />
                    </Field>
                  )}

                  {cashTarget === 'goods' && (
                    <GoodsCostPicker
                      mode={goodsMode}
                      setMode={setGoodsMode}
                      invoiceIds={invoiceIds}
                      setInvoiceIds={setInvoiceIds}
                      goodsItems={goodsItems}
                      setGoodsItems={setGoodsItems}
                    />
                  )}

                  {(cashTarget === 'warehouse' || cashTarget === 'external') && (
                    <Field label={cashTarget === 'external' ? 'بند المصروف الخارجي (ناولون/تخليص...)' : 'بند مصروف المخزن (تحميل/تخليص...)'} full>
                      <Combobox
                        options={(cats?.data ?? []).filter((c) => (c.group ?? 'WAREHOUSE') === (cashTarget === 'external' ? 'EXTERNAL' : 'WAREHOUSE'))}
                        value={categoryId} onChange={setCategoryId}
                        placeholder={cashTarget === 'external' ? 'اختر البند' : 'اختياري'}
                      />
                      <div style={{ marginTop: 8 }}>
                        <ExpenseCategoriesManager canManage addOnly />
                      </div>
                    </Field>
                  )}
                </>
              )}

              {(type === 'collect' || type === 'paySupplier' || type === 'adjust') && (
                <Field label={type === 'collect' ? 'العميل' : type === 'paySupplier' ? 'المورد' : 'الحساب'}>
                  <PartyCombobox
                    parties={type === 'adjust' ? [...(clients?.data ?? []), ...(suppliers?.data ?? []), ...(agents?.data ?? [])] : parties}
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

              {type === 'balanceTransfer' && (
                <>
                  <Field label="من طرف (المُحوِّل)">
                    <PartyCombobox parties={allParties} value={partyId} onChange={setPartyId} role="CLIENT" />
                  </Field>
                  <Field label="إلى طرف (المستلم)">
                    <PartyCombobox parties={allParties} value={partyId2} onChange={setPartyId2} role="CLIENT" />
                  </Field>
                </>
              )}

              {type === 'expense' && (
                <Field label="العميل (اختياري)">
                  <Combobox options={clients?.data ?? []} value={expensePartyId} onChange={setExpensePartyId} placeholder="اختياري — لتسجيله على حساب عميل" />
                </Field>
              )}

              {type === 'expense' && (
                <Field label="بند المصروف" full>
                  <Combobox options={cats?.data ?? []} value={categoryId} onChange={setCategoryId} />
                  <div style={{ marginTop: 8 }}>
                    <ExpenseCategoriesManager canManage addOnly />
                  </div>
                </Field>
              )}

              {type !== 'adjust' && type !== 'balanceTransfer' && !(type === 'cash' && cashTarget === 'account')
                && !(type === 'cash' && cashTarget === 'custody' && cashDir === 'in' && (custodyDest === 'client' || custodyDest === 'category')) && (
                <Field label={type === 'transfer' ? 'من حساب' : type === 'partyTransfer' ? 'من خزنة' : 'حساب الخزنة'}>
                  <Combobox options={treasury?.data ?? []} value={treasuryId} onChange={setTreasuryId} placeholder={type === 'partyTransfer' ? 'اختياري…' : undefined} />
                </Field>
              )}

              {type === 'transfer' && (
                <Field label="إلى حساب (أي خزينة)">
                  <Combobox options={treasuryNames ?? []} value={treasuryId2} onChange={setTreasuryId2} />
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
                    <option value="debit">عليه (يزيد المستحق عليه)</option>
                    <option value="credit">له (يقلل المستحق عليه)</option>
                  </select>
                </Field>
              )}

              <Field label={usdPay ? `المبلغ (مصري) + سعر الدولار${usdResult ? ` = ${usdResult.toFixed(2)} $` : ''}` : diffCur ? `المبلغ (${treasuryCur})` : 'المبلغ'}>
                {usdPay ? (
                  <div className="usd-row">
                    <MoneyInput value={amount} onChange={setAmount} placeholder="بالمصري" style={{ flex: 1, minWidth: 0 }} />
                    <MoneyInput value={rate} onChange={setRate} placeholder="سعر $" style={{ width: 90, minWidth: 0 }} />
                  </div>
                ) : (
                  <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
                )}
              </Field>
              {activeParty && (
                <div style={{ gridColumn: '1/-1', fontSize: 12.5, fontWeight: 700 }}>
                  رصيد {activeParty.name} الحالي: <span className={(activeParty.balance ?? 0) >= 0 ? 'deb' : 'cre'}>{EGP(Math.abs(activeParty.balance ?? 0))} {(activeParty.balance ?? 0) >= 0 ? 'عليه' : 'له'}</span>
                </div>
              )}
              <Field label="البيان" full><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            </div>
            {(type === 'collect' || type === 'unknownCollect') && (
              <div className="fee-row">
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, flex: 1 }}>
                  <input type="checkbox" checked={addFee} onChange={(e) => setAddFee(e.target.checked)} />
                  <span>إضافة رسوم نقل {type === 'unknownCollect' ? '(تُسجَّل وقت الترحيل)' : '(تُسجَّل على العميل)'}</span>
                </label>
                {addFee && <MoneyInput value={feeAmount} onChange={setFeeAmount} placeholder="500" style={{ width: 110, minWidth: 0 }} />}
              </div>
            )}
            <div className="err-text" style={{ padding: '0 16px' }}>{error}</div>
            {msg && <div style={{ padding: '0 16px', color: 'var(--credit)', fontWeight: 700 }}>{msg}</div>}
            <div className="toolbar" style={{ padding: 16 }}>
              <button className="btn btn-primary entry-submit" onClick={submit} disabled={postEntry.isPending}>تسجيل الحركة</button>
            </div>
          </>
        )}
      </div>

      {type === 'cash' && cashTarget === 'warehouse' && user?.isPrimary && <WarehouseSchedulesManager />}

      <PendingCollections />
    </>
  );
}
