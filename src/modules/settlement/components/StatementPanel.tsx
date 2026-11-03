'use client';

import { useState } from 'react';
import { EGP, fmtDate, todayISO } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { Field, MoneyInput, Spinner, StatCard, StatsGrid } from '@/components/common';
import { useAddCapitalMovement, useAddPayment, useDeleteCapitalMovement, useDeletePayment, useStatement } from '../hooks';
import type { Partner } from '../dtos';
import { SETTLE, TreasurySelect } from './TreasurySelect';

/**
 * كشف حساب التصفية: سطر لكل فاتورة مصفّاة بمستحقها ومن أين جاء، وسطر لكل دفعة
 * تسلّمها بالسالب، والرصيد التراكمي بينهما.
 *   برأس المال: المتبقي = المستحق − المدفوع، والدفعة في هذا الكشف فقط.
 *   ثابتة: الكشف تصفية ومدفوعات وسحب — الرصيد = المدفوعات + التصفية − السحب.
 *   المدفوعات (إضافة لرأس المال) تدخل خزنة، والسحب يخرج منها، وكلاهما في حساب
 *   الاسم في البرنامج (ميزان المراجعة والتقارير).
 */
export function StatementPanel({ partner }: { partner: Partner }) {
  const { user } = useAuth();
  const isAdmin = !!user?.admin;
  const { data, isLoading } = useStatement(partner.id);
  const del = useDeletePayment(partner.id);
  const delCapital = useDeleteCapitalMovement(partner.id);
  // ثابتة: «مدفوعات» (in) أو «سحب» (out). برأس المال: دفعة فقط
  const [form, setForm] = useState<null | 'in' | 'out'>(null);

  if (isLoading || !data) return <Spinner />;

  const byCapital = partner.shareBasis === 'CAPITAL';

  return (
    <>
      <StatsGrid columns={byCapital ? 3 : 4}>
        {!byCapital && <StatCard label="المدفوعات" value={EGP(data.capital)} />}
        <StatCard label={byCapital ? `مستحق ${partner.name}` : 'التصفية'} value={EGP(data.dues)} variant="blue" />
        <StatCard label={byCapital ? 'المدفوع له' : 'السحب'} value={EGP(data.paid)} variant="gold" />
        <StatCard
          label={byCapital ? 'المتبقي' : 'الرصيد له'}
          value={EGP(data.total)}
          variant={data.total < 0 ? 'debit' : 'accent'}
        />
      </StatsGrid>

      <div className="muted" style={{ fontSize: 12, margin: '6px 2px 10px' }}>
        {byCapital
          ? 'كل سطر مستحق نصيب من صافي ربح فاتورة بنسبة رأس المال.'
          : 'الرصيد = المدفوعات + التصفية − السحب.'}
        {' '}{byCapital
          ? 'المتبقي = المستحق − المدفوع. الدفعة تُسجل هنا ولا تمس الخزنة.'
          : 'المدفوعات تدخل الخزنة والسحب يخرج منها، وكلاهما في ميزان المراجعة.'}
      </div>

      {isAdmin && (
        <div className="toolbar">
          {!byCapital && (
            <button className="btn btn-primary btn-sm" onClick={() => setForm((f) => (f === 'in' ? null : 'in'))}>
              {form === 'in' ? 'إلغاء' : '+ مدفوعات'}
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setForm((f) => (f === 'out' ? null : 'out'))}>
            {form === 'out' ? 'إلغاء' : byCapital ? '+ تسجيل دفعة' : '+ سحب'}
          </button>
        </div>
      )}

      {form && <PaymentForm key={form} partner={partner} mode={form} onDone={() => setForm(null)} />}

      {!data.entries.length ? (
        <div className="card" style={{ padding: 16 }}>
          <b>لا توجد حركات في كشف حساب {partner.name} حتى الآن.</b>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {byCapital
              ? 'تظهر الحركات بعد اختيار الفواتير وتسعير أصنافها من قوائم أسعار المورد.'
              : 'تظهر الحركات بعد تصفية الأصناف، أو تسجيل مدفوعات أو سحب.'}
          </div>
        </div>
      ) : (
        <div className="card tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الحركة</th>
                <th>المصدر</th>
                <th className="num">المبلغ</th>
                <th className="num">الرصيد</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e, i) => (
                <tr
                  key={e.id ?? `${e.date}-${e.label}-${i}`}
                  style={e.kind === 'PAYMENT' ? { background: 'var(--gold-soft, transparent)' }
                    : e.kind === 'CAPITAL' ? { background: 'var(--accent-soft)' } : undefined}
                >
                  <td>{fmtDate(e.date)}</td>
                  <td><b>{e.label}</b></td>
                  <td className="muted" style={{ fontSize: 12 }}>{e.source}</td>
                  <td className="num" style={{ color: e.amount < 0 ? 'var(--debit)' : undefined }}>
                    {EGP(e.amount)}
                  </td>
                  <td className="num"><b>{EGP(e.balance)}</b></td>
                  {isAdmin && (
                    <td>
                      {e.id && (e.kind === 'PAYMENT' || e.capital) && (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={del.isPending || delCapital.isPending}
                          onClick={() => {
                            const msg = byCapital ? 'حذف هذه الدفعة من كشف الحساب؟' : `حذف ${e.label}؟ يُحذف من الخزنة أيضاً.`;
                            if (!window.confirm(msg)) return;
                            if (e.capital) delCapital.mutate(e.id!); else del.mutate(e.id!);
                          }}
                        >
                          حذف
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={3}>{byCapital ? 'المتبقي' : 'الرصيد له'}</th>
                <th className="num">{EGP(data.total)}</th>
                <th className="num">{EGP(data.total)}</th>
                {isAdmin && <th></th>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}

/**
 * تسجيل دفعة: التاريخ والمبلغ وملاحظة، والمبلغ موجب دائماً.
 *   out: سحب (أو دفعة برأس المال) — ينزل من الرصيد
 *   in:  مدفوعات في التصفية الثابتة — إضافة لرأس المال، تدخل الخزنة وتزود الرصيد
 */
function PaymentForm({ partner, mode, onDone }: { partner: Partner; mode: 'in' | 'out'; onDone: () => void }) {
  const addOut = useAddPayment(partner.id);
  const addIn = useAddCapitalMovement(partner.id);
  const add = mode === 'in' ? addIn : addOut;
  const fixed = partner.shareBasis === 'FIXED';
  const title = mode === 'in' ? 'مدفوعات' : fixed ? 'سحب' : 'دفعة';
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [treasuryId, setTreasuryId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (!date) return setError('حدد التاريخ');
    if (!(Number(amount) > 0)) return setError('اكتب مبلغ الدفعة');
    if (fixed && !treasuryId) return setError(mode === 'in' ? 'اختر الخزنة أو التسوية' : 'اختر الخزنة');
    setError('');
    // المدفوعات (إضافة لرأس المال) ممكن تبقى تسوية على حسابه من غير خزنة
    const where = !fixed ? {} : treasuryId === SETTLE ? { settle: true } : { treasuryId };
    const dto = { date, amount: Number(amount), note: note || undefined, ...where };
    const opts = { onSuccess: onDone, onError: (e: any) => setError(e.message) };
    if (mode === 'in') addIn.mutate(dto, opts); else addOut.mutate(dto, opts);
  };

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <b style={{ display: 'block', marginBottom: 10 }}>{title} — {partner.name}</b>
      <div className="form-grid">
        <Field label="التاريخ">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="المبلغ (ج.م)">
          <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
        </Field>
        {fixed && (
          <Field label={mode === 'in' ? 'الخزنة أو التسوية' : 'من الخزنة'}>
            <TreasurySelect value={treasuryId} onChange={setTreasuryId} allowSettle={mode === 'in'} />
          </Field>
        )}
        <Field label="ملاحظة">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" />
        </Field>
      </div>

      {error && <div className="err-text" style={{ marginTop: 8 }}>{error}</div>}

      <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
        <button className="btn btn-primary" disabled={add.isPending} onClick={submit}>
          {add.isPending ? '...' : `حفظ ${title}`}
        </button>
        <button className="btn btn-ghost" onClick={onDone}>إلغاء</button>
      </div>
    </div>
  );
}
