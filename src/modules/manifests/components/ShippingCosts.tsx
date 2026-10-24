'use client';

import { useState } from 'react';
import { EGP, fmtDate, todayISO } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { Field, MoneyInput, Spinner } from '@/components/common';
import { useAddClearanceExpense, useClearanceAgents, useDeleteClearanceMovement } from '../../clearance/hooks';
import { useAssignCharge, useVehicleShipping } from '../hooks';

const selectStyle = {
  width: '100%', padding: '11px 12px', border: '1.5px solid var(--line)', borderRadius: 10, background: '#fff',
};

/**
 * قسم «تكاليف الشحن» في كشف العربية:
 *   ربح العربية = بنود الشحن على العملاء − (الإيجار + الجمرك والتخليص + التحميل + الشفتنة)
 * الإيجار من كشف السائقين، والجمرك والتخليص يُكتب هنا ويترحّل على حساب مكتب التخليص،
 * والتحميل والشفتنة من صرف النقدية لما تتربط بالعربية. كل المبالغ يدوية.
 */
export function ShippingCosts({ manifestId }: { manifestId: string }) {
  const { can } = useAuth();
  const { data: s, isLoading } = useVehicleShipping(manifestId);
  const assign = useAssignCharge();
  const delCustoms = useDeleteClearanceMovement();
  const [customsForm, setCustomsForm] = useState(false);

  if (isLoading || !s) return <div className="card no-print" style={{ padding: 16, marginBottom: 12 }}><Spinner /></div>;

  const ours = s.vehicleSource === 'OURS';
  const canCustoms = can('clearance.expense') || can('manifests.shipping');

  const row = (label: React.ReactNode, amount: number, opts: { strong?: boolean; minus?: boolean; color?: string } = {}) => (
    <div className="mf-info">
      <span className="mf-info-l">{label}</span>
      <span className="mf-info-v num" style={{ fontWeight: opts.strong ? 800 : 600, color: opts.color }}>
        {opts.minus && amount ? '− ' : ''}{EGP(amount)}
      </span>
    </div>
  );

  return (
    <div className="card no-print" style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 15 }}>🚛 تكاليف الشحن</b>
        <span className="muted" style={{ fontSize: 12 }}>نشاط الشحن — كل المبالغ تُكتب يدوياً</span>
      </div>

      {/* الإيراد: بنود الشحن على العميل */}
      <div style={{ fontWeight: 700, fontSize: 13, margin: '6px 0' }}>بنود الشحن على العملاء</div>
      {s.revenue.length ? (
        <div className="tbl-wrap" style={{ marginBottom: 8 }}>
          <table>
            <thead><tr><th>البند</th><th>الفاتورة</th><th className="num">الكمية</th><th className="num">السعر</th><th className="num">الإجمالي</th></tr></thead>
            <tbody>
              {s.revenue.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}{r.note ? <span className="muted"> · {r.note}</span> : null}</td>
                  <td className="muted">{r.invoiceNo ? `#${r.invoiceNo}` : '—'}</td>
                  <td className="num">{r.qty}</td>
                  <td className="num">{EGP(r.price)}</td>
                  <td className="num">{EGP(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
          {s.invoice ? 'لا توجد بنود شحن على فاتورة هذه العربية' : 'العربية غير مربوطة بفاتورة، لذلك لا توجد بنود شحن'}
        </div>
      )}

      {/* بنود على فاتورة عليها أكثر من عربية — تُربط يدوياً */}
      {!!s.unassignedCharges.length && (
        <div style={{ padding: 10, borderRadius: 8, background: 'var(--line-soft)', marginBottom: 10, fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            بنود على الفاتورة #{s.invoice?.no} غير مربوطة بعربية (الفاتورة عليها أكثر من عربية)
          </div>
          {s.unassignedCharges.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
              <span>{c.name}</span>
              <span className="num">{EGP(c.total)}</span>
              {can('manifests.shipping') && (
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={assign.isPending}
                  onClick={() => assign.mutate({ id: s.id, chargeId: c.id, assign: true })}
                >ربط بهذه العربية</button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mf-grid" style={{ marginBottom: 10 }}>
        {row('إجمالي بنود الشحن', s.revenueTotal, { strong: true })}
      </div>

      {/* التكاليف */}
      <div style={{ fontWeight: 700, fontSize: 13, margin: '10px 0 6px' }}>التكاليف</div>
      <div className="mf-grid">
        {row(
          <>الإيجار {s.rent.lines.length ? <span className="muted">({s.rent.lines.map((l) => l.driverName).join('، ')})</span> : <span className="muted">(لا توجد رحلة في كشف السائقين)</span>}</>,
          s.rent.total, { minus: true },
        )}
        {row('الجمرك والتخليص', s.customs.total, { minus: true })}
        {s.vehicleExpenses.byCategory.map((c) => (
          <div key={c.name} style={{ display: 'contents' }}>{row(c.name, c.total, { minus: true })}</div>
        ))}
        {!s.vehicleExpenses.byCategory.length && row(<>التحميل والشفتنة <span className="muted">(لا توجد مصاريف مربوطة)</span></>, 0)}
        {s.freight.total !== 0 && row(
          <>الناولون <span className="muted">(فاتورة {s.freight.lines[0]?.invoiceNo}{s.freight.shared ? '، نصيب العربية' : ''})</span></>,
          s.freight.total, { minus: true },
        )}
      </div>

      {/* تفاصيل الجمرك والتخليص */}
      {!!s.customs.lines.length && (
        <div className="tbl-wrap" style={{ margin: '8px 0' }}>
          <table>
            <thead><tr><th>التاريخ</th><th>مكتب التخليص</th><th>البيان</th><th className="num">المبلغ</th><th></th></tr></thead>
            <tbody>
              {s.customs.lines.map((l) => (
                <tr key={l.id}>
                  <td className="muted">{fmtDate(l.date)}</td>
                  <td>{l.office?.name ?? '—'}</td>
                  <td className="muted">{l.note ?? ''}</td>
                  <td className="num">{EGP(l.amount)}</td>
                  <td>
                    {can('clearance.delete') && (
                      <button
                        className="btn btn-ghost btn-sm" style={{ color: 'var(--debit)' }} disabled={delCustoms.isPending}
                        onClick={() => { if (window.confirm('حذف هذا المبلغ من العربية ومن حساب مكتب التخليص؟')) delCustoms.mutate(l.id); }}
                      >حذف</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* تفاصيل التحميل والشفتنة */}
      {!!s.vehicleExpenses.lines.length && (
        <div className="tbl-wrap" style={{ margin: '8px 0' }}>
          <table>
            <thead><tr><th>التاريخ</th><th>البند</th><th>الخزنة</th><th>البيان</th><th className="num">المبلغ</th></tr></thead>
            <tbody>
              {s.vehicleExpenses.lines.map((l) => (
                <tr key={l.id}>
                  <td className="muted">{fmtDate(l.date)}</td>
                  <td>{l.category ?? '—'}</td>
                  <td className="muted">{l.treasury ?? '—'}</td>
                  <td className="muted">{l.note ?? ''}</td>
                  <td className="num">{EGP(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ours && canCustoms && (
        customsForm
          ? <CustomsForm manifestId={s.id} onDone={() => setCustomsForm(false)} />
          : <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => setCustomsForm(true)}>+ جمرك وتخليص</button>
      )}
      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        التحميل والشفتنة تُسجَّل من «صرف وتوريد النقدية ← مصاريف المخزن» مع اختيار العربية.
      </div>

      <div className="mf-grid" style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
        {row('إجمالي التكاليف', s.costs, { minus: true })}
        {row('ربح العربية', s.profit, { strong: true, color: s.profit < 0 ? 'var(--debit)' : 'var(--credit, #15803d)' })}
      </div>

      {!!s.otherExpenses.lines.length && (
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          مصاريف أخرى مربوطة بالعربية (للعرض فقط، غير داخلة في الربح): {EGP(s.otherExpenses.total)}
        </div>
      )}
    </div>
  );
}

/** جمرك وتخليص على العربية — مبلغ يدوي + مكتب التخليص، ويترحّل على حساب المكتب. */
function CustomsForm({ manifestId, onDone }: { manifestId: string; onDone: () => void }) {
  const { data: agents } = useClearanceAgents();
  const add = useAddClearanceExpense();
  const [agentId, setAgentId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const list = agents ?? [];

  const save = () => {
    setErr('');
    if (!agentId) return setErr('اختر مكتب التخليص');
    if (!Number(amount)) return setErr('اكتب المبلغ');
    add.mutate(
      { manifestId, agentId, date, amount: Number(amount), note: note.trim() || undefined },
      { onSuccess: onDone, onError: (e: any) => setErr(e?.message || 'تعذر الحفظ') },
    );
  };

  return (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: 'var(--line-soft)' }}>
      {!list.length ? (
        <div className="muted" style={{ fontSize: 13 }}>لا توجد مكاتب تخليص. أضف مكتباً من صفحة «مكاتب التخليص» أولاً.</div>
      ) : (
        <div className="form-grid">
          <Field label="مكتب التخليص">
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} style={selectStyle}>
              <option value="">اختر المكتب</option>
              {list.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="المبلغ"><MoneyInput value={amount} onChange={setAmount} placeholder="0.00" /></Field>
          <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="البيان (اختياري)"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
      )}
      {err && <div className="err-text">{err}</div>}
      <div className="toolbar" style={{ marginTop: 6, marginBottom: 0 }}>
        {!!list.length && <button className="btn btn-primary btn-sm" onClick={save} disabled={add.isPending}>{add.isPending ? '…' : 'ترحيل على المكتب'}</button>}
        <button className="btn btn-ghost btn-sm" onClick={onDone}>إلغاء</button>
      </div>
    </div>
  );
}
