'use client';

import { useState } from 'react';
import { EGP, fmtDate, todayISO } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { Field, MoneyInput, Spinner, StatCard, StatsGrid } from '@/components/common';
import { useAddPayment, useDeletePayment, useStatement } from '../hooks';
import type { Partner } from '../dtos';

/**
 * كشف حساب التصفية: سطر لكل فاتورة مصفّاة بمستحقها ومن أين جاء، وسطر لكل دفعة
 * تسلّمها بالسالب، والرصيد التراكمي بينهما. فالمتبقي له = المستحق − المدفوع.
 *
 * الدفعة حركة في هذا الكشف فقط — لا تُنشئ حركة خزنة ولا سطر Transaction.
 */
export function StatementPanel({ partner }: { partner: Partner }) {
  const { user } = useAuth();
  const isAdmin = !!user?.admin;
  const { data, isLoading } = useStatement(partner.id);
  const del = useDeletePayment(partner.id);
  const [paying, setPaying] = useState(false);

  if (isLoading || !data) return <Spinner />;

  const byCapital = partner.shareBasis === 'CAPITAL';

  return (
    <>
      <StatsGrid columns={3}>
        <StatCard label={`مستحق ${partner.name}`} value={EGP(data.dues)} variant="blue" />
        <StatCard label="المدفوع له" value={EGP(data.paid)} variant="gold" />
        <StatCard
          label="المتبقي"
          value={EGP(data.total)}
          variant={data.total < 0 ? 'debit' : 'accent'}
        />
      </StatsGrid>

      <div className="muted" style={{ fontSize: 12, margin: '6px 2px 10px' }}>
        {byCapital
          ? 'كل سطر مستحق نصيب من صافي ربح فاتورة بنسبة رأس المال.'
          : 'كل سطر مستحق كمية فاتورة شراء مضروبة في المبلغ للوحدة.'}
        {' '}المتبقي = المستحق − المدفوع. الدفعة تُسجل هنا ولا تمس الخزنة.
      </div>

      {isAdmin && (
        <div className="toolbar">
          <button className="btn btn-primary btn-sm" onClick={() => setPaying((p) => !p)}>
            {paying ? 'إلغاء' : '+ تسجيل دفعة'}
          </button>
        </div>
      )}

      {paying && <PaymentForm partner={partner} onDone={() => setPaying(false)} />}

      {!data.entries.length ? (
        <div className="card" style={{ padding: 16 }}>
          <b>لا توجد حركات في كشف حساب {partner.name} حتى الآن.</b>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {byCapital
              ? 'تظهر الحركات بعد اختيار الفواتير وتسعير أصنافها من قوائم أسعار المورد.'
              : 'تظهر الحركات بعد اختيار فواتير الشراء وكتابة المبلغ للوحدة لكل واحدة.'}
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
                  style={e.kind === 'PAYMENT' ? { background: 'var(--gold-soft, transparent)' } : undefined}
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
                      {e.kind === 'PAYMENT' && e.id && (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={del.isPending}
                          onClick={() => {
                            if (window.confirm('حذف هذه الدفعة من كشف الحساب؟')) del.mutate(e.id!);
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
                <th colSpan={3}>المتبقي</th>
                <th className="num">{EGP(data.dues - data.paid)}</th>
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

/** تسجيل دفعة: التاريخ والمبلغ وملاحظة. المبلغ موجب دائماً وينزل من المستحق. */
function PaymentForm({ partner, onDone }: { partner: Partner; onDone: () => void }) {
  const add = useAddPayment(partner.id);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (!date) return setError('حدد التاريخ');
    if (!(Number(amount) > 0)) return setError('اكتب مبلغ الدفعة');
    setError('');
    add.mutate(
      { date, amount: Number(amount), note: note || undefined },
      { onSuccess: onDone, onError: (e: any) => setError(e.message) },
    );
  };

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <b style={{ display: 'block', marginBottom: 10 }}>دفعة لـ {partner.name}</b>
      <div className="form-grid">
        <Field label="التاريخ">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="المبلغ (ج.م)">
          <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
        </Field>
        <Field label="ملاحظة">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" />
        </Field>
      </div>

      {error && <div className="err-text" style={{ marginTop: 8 }}>{error}</div>}

      <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
        <button className="btn btn-primary" disabled={add.isPending} onClick={submit}>
          {add.isPending ? '...' : 'حفظ الدفعة'}
        </button>
        <button className="btn btn-ghost" onClick={onDone}>إلغاء</button>
      </div>
    </div>
  );
}
