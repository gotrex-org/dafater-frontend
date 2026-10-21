'use client';

import { useState } from 'react';
import { EGP, fmtDate, todayISO } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { PageTitle, Field, Combobox, MoneyInput, Spinner } from '@/components/common';
import { useManifests } from '../../manifests/hooks';
import { useAllTreasury } from '../../treasury/hooks';
import { useAllExpenseCategories } from '../../expense-categories/hooks';
import { useAllParties } from '../../parties/hooks';
import {
  useAddCashClearance, useAddClearanceExpense, useArchiveClearanceAgent, useClearance, useClearanceAgents,
  useClearanceStatement, useCreateClearanceAgent, useDeleteClearanceAgent, useDeleteClearanceMovement,
  usePayClearanceAgent, useUpdateClearanceAgent, useUpdateClearanceMovement,
} from '../hooks';
import type { ClearanceAgent, ClearanceMovement } from '../dtos';

const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const inputStyle = { padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13 };
const selectStyle = { width: '100%', padding: '11px 12px', border: '1.5px solid var(--line)', borderRadius: 10, background: '#fff' };

const EXPENSE = 'جمارك';
const PAY = 'سداد مخلّص';

/** نوع الحركة في الشاشة */
type Kind = 'vehicle' | 'cash' | 'pay';
const KIND_LABEL: Record<Kind, string> = {
  vehicle: 'تخليص عربية',
  cash: 'تخليص نقدي',
  pay: 'دفعة للمكتب',
};

/** حركة التخليص النقدي ليها رجلين بنفس groupId: المصروف والدفعة. */
const kindOf = (m: ClearanceMovement): Kind | 'cashPay' | null =>
  m.type === EXPENSE ? (m.groupId ? 'cash' : 'vehicle')
  : m.type === PAY ? (m.groupId ? 'cashPay' : 'pay')
  : null;

/** رقم الرأس + المقطورة */
const vehicleOf = (m?: ClearanceMovement['manifest']) =>
  m ? [m.vehicleNo, m.trailerNo].filter(Boolean).join(' / ') || '—' : '—';

/** الحركة اللي بتتفتح للتعديل + رجلها التانية لو تخليص نقدي */
type Editing = { movement: ClearanceMovement; sibling?: ClearanceMovement };

/**
 * مكاتب التخليص — كل حاجة من مكان واحد:
 *   المكاتب: إضافة، تعديل، أرشفة/استعادة، حذف (لو مالوش حركات).
 *   الحركات: تخليص عربية (على حساب المكتب)، تخليص نقدي (من الخزنة على طول)، دفعة للمكتب،
 *   وتعديل أو حذف أي حركة. كل الحركات نشاطها «شحن».
 */
export function ClearanceView() {
  const { can } = useAuth();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<Kind | 'office' | null>(null);
  const [statementId, setStatementId] = useState<string | null>(null);
  const [editingOffice, setEditingOffice] = useState<ClearanceAgent | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);

  const { data, isLoading } = useClearance({ from: from || undefined, to: to || undefined, archived: showArchived });
  const { data: agents } = useClearanceAgents();
  const archive = useArchiveClearanceAgent();
  const delAgent = useDeleteClearanceAgent();
  const [officeErr, setOfficeErr] = useState('');

  const activeAgents = agents ?? [];
  const noAgents = activeAgents.length === 0;
  const totalDue = (data?.agents ?? []).reduce((s, a) => s + a.due, 0);
  const movements = data?.movements ?? [];

  if (statementId) {
    return <OfficeStatement id={statementId} onBack={() => setStatementId(null)} agents={activeAgents} />;
  }

  const toggle = (k: Kind | 'office') => setForm(form === k ? null : k);

  return (
    <>
      <PageTitle
        title="مكاتب التخليص"
        subtitle="تخليص العربيات على حساب المكتب أو نقدي من الخزنة، والدفعات للمكاتب، وكشف حساب كل مكتب. كل الحركات نشاطها شحن."
      />

      <div className="toolbar" style={{ flexWrap: 'wrap' }}>
        {can('clearance.offices') && (
          <button className="btn btn-primary btn-sm" onClick={() => toggle('office')}>{form === 'office' ? '× إلغاء' : '+ مكتب تخليص'}</button>
        )}
        {can('clearance.expense') && (
          <>
            <button className="btn btn-ghost btn-sm" disabled={noAgents} onClick={() => toggle('vehicle')}>{form === 'vehicle' ? '× إلغاء' : '+ تخليص عربية'}</button>
            <button className="btn btn-ghost btn-sm" disabled={noAgents} onClick={() => toggle('cash')}>{form === 'cash' ? '× إلغاء' : '+ تخليص نقدي'}</button>
          </>
        )}
        {can('clearance.pay') && (
          <button className="btn btn-ghost btn-sm" disabled={noAgents} onClick={() => toggle('pay')}>{form === 'pay' ? '× إلغاء' : '+ دفعة للمكتب'}</button>
        )}
        <span className="muted" style={{ fontSize: 12, marginInlineStart: 'auto' }}>من</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
        <span className="muted" style={{ fontSize: 12 }}>إلى</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
      </div>

      {form === 'office' && <OfficeForm onDone={() => setForm(null)} />}
      {(form === 'vehicle' || form === 'cash' || form === 'pay') && (
        <div className="card" style={{ marginBottom: 12 }}>
          <MovementForm mode={form} agents={activeAgents} onDone={() => setForm(null)} />
        </div>
      )}

      {noAgents && !showArchived && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <b>لا توجد مكاتب تخليص نشطة.</b>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>أضف مكتباً من زر «+ مكتب تخليص».</div>
        </div>
      )}

      {/* ── المكاتب ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>المكاتب</h3>
        <label className="check-inline" style={{ fontSize: 12.5, marginInlineStart: 'auto' }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          عرض المكاتب المؤرشفة
        </label>
      </div>
      {officeErr && <div className="err-text" style={{ marginBottom: 6 }}>{officeErr}</div>}
      {!!data?.agents?.length && (
        <div className="card tbl-wrap" style={{ marginBottom: 12 }}>
          <table>
            <thead>
              <tr>
                <th>المكتب</th><th>التليفون</th><th>ملاحظات</th>
                <th className="num">تخليص (الفترة)</th><th className="num">دفعات (الفترة)</th>
                <th className="num">المستحق للمكتب</th><th></th>
              </tr>
            </thead>
            <tbody>
              {data.agents.map((a) => (
                <tr key={a.id} style={{ opacity: a.hidden ? 0.6 : 1 }}>
                  <td>
                    <b style={{ cursor: 'pointer' }} onClick={() => setStatementId(a.id)}>{a.name}</b>
                    {a.hidden && <span className="pill" style={{ marginInlineStart: 6, fontSize: 11 }}>مؤرشف</span>}
                    {a.supplier && <div className="muted" style={{ fontSize: 11.5 }}>يُرحَّل على حساب المورد {a.supplier.name}</div>}
                  </td>
                  <td className="muted">{a.phone || '—'}</td>
                  <td className="muted" style={{ maxWidth: 220 }}>{a.note || ''}</td>
                  <td className="num">{EGP(a.expenses)}</td>
                  <td className="num">{EGP(a.paid)}</td>
                  <td className="num" style={{ fontWeight: 800, color: a.due > 0 ? 'var(--debit)' : undefined }}>
                    {EGP(Math.abs(a.due))} {a.due < 0 ? '(مدفوع زيادة)' : ''}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setStatementId(a.id)}>كشف حساب</button>
                    {can('clearance.offices') && (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingOffice({ id: a.id, name: a.name, phone: a.phone, note: a.note, supplier: a.supplier })}>تعديل</button>
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={archive.isPending}
                          onClick={() => {
                            setOfficeErr('');
                            if (!a.hidden && Math.abs(a.due) > 0.005 && !window.confirm(`المكتب ${a.name} عليه رصيد ${EGP(a.due)}. أرشفته لن تغيّر الرصيد. متابعة؟`)) return;
                            archive.mutate({ id: a.id, archived: !a.hidden }, { onError: (e: any) => setOfficeErr(e.message) });
                          }}
                        >{a.hidden ? 'استعادة' : 'أرشفة'}</button>
                        <button
                          className="btn btn-ghost btn-sm" style={{ color: 'var(--debit)' }}
                          disabled={delAgent.isPending}
                          onClick={() => {
                            setOfficeErr('');
                            if (!window.confirm(`حذف المكتب ${a.name} نهائياً؟ الحذف متاح فقط للمكتب الذي ليس عليه حركات.`)) return;
                            delAgent.mutate(a.id, { onError: (e: any) => setOfficeErr(e.message) });
                          }}
                        >حذف</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="mf-total">
                <td colSpan={5}><b>إجمالي المستحق لمكاتب التخليص</b></td>
                <td className="num"><b>{EGP(totalDue)}</b></td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── الحركات ── */}
      <h3 style={{ margin: '16px 0 8px', fontSize: 15 }}>حركات التخليص في الفترة</h3>
      <div className="card tbl-wrap">
        {isLoading ? <Spinner /> : (
          <MovementsTable
            rows={movements}
            showOffice
            onEdit={(m) => setEditing({ movement: m, sibling: siblingOf(m, movements) })}
          />
        )}
      </div>

      {editingOffice && (
        <Modal title={`تعديل المكتب: ${editingOffice.name}`} onClose={() => setEditingOffice(null)}>
          <OfficeForm agent={editingOffice} onDone={() => setEditingOffice(null)} bare />
        </Modal>
      )}
      {editing && (
        <EditMovementModal editing={editing} agents={activeAgents} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

const siblingOf = (m: ClearanceMovement, rows: ClearanceMovement[]) =>
  m.groupId ? rows.find((r) => r.groupId === m.groupId && r.id !== m.id) : undefined;

/* ── جدول الحركات (مشترك بين الشاشة الرئيسية وكشف الحساب) ───────────────── */
function MovementsTable({ rows, showOffice, withBalance, onEdit }: {
  rows: ClearanceMovement[];
  showOffice?: boolean;
  withBalance?: boolean;
  onEdit: (m: ClearanceMovement) => void;
}) {
  const { can } = useAuth();
  const del = useDeleteClearanceMovement();
  const cols = 8 + (showOffice ? 1 : 0) + (withBalance ? 1 : 0);

  return (
    <table>
      <thead>
        <tr>
          <th>التاريخ</th><th>النوع</th><th>البيان</th><th>رقم الرأس / المقطورة</th><th>الكشف</th>
          {showOffice && <th>المكتب</th>}
          <th>الخزنة</th>
          <th className="num">تخليص (له)</th><th className="num">دفعة (عليه)</th>
          {withBalance && <th className="num">الرصيد</th>}
          <th className="no-print"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => {
          const k = kindOf(m);
          return (
            <tr key={m.id}>
              <td className="muted">{fmtDate(m.date)}</td>
              <td>
                {k === 'cashPay'
                  ? <span className="muted" style={{ fontSize: 12 }}>دفعة (ضمن تخليص نقدي)</span>
                  : k ? <span className="pill" style={{ fontSize: 11.5 }}>{KIND_LABEL[k]}</span>
                  : <span className="muted" style={{ fontSize: 12 }}>{m.type}</span>}
              </td>
              <td>
                {m.note || m.type}
                {m.category ? <span className="muted"> · {m.category.name}</span> : null}
              </td>
              <td className="num">{vehicleOf(m.manifest)}</td>
              <td>{m.manifest ? `كشف ${m.manifest.no}` : <span className="muted">—</span>}</td>
              {showOffice && (
                <td>
                  {(m.clearanceAgent ?? m.party)?.name ?? '—'}
                  {m.party?.role === 'SUPPLIER' && <div className="muted" style={{ fontSize: 11.5 }}>حساب المورد {m.party.name}</div>}
                </td>
              )}
              <td className="muted">
                {m.treasury
                  ? `${m.treasury.name}${m.treasury.currency === 'USD' && m.cashOut ? ` (${m.cashOut} $${m.exchangeRate ? ` × ${m.exchangeRate}` : ''})` : ''}`
                  : '—'}
              </td>
              <td className="num deb">{m.credit ? EGP(m.credit) : ''}</td>
              <td className="num cre">{m.debit ? EGP(m.debit) : ''}</td>
              {withBalance && <td className="num" style={{ fontWeight: 700 }}>{EGP(m.balance ?? 0)}</td>}
              <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                {k && k !== 'cashPay' && can('clearance.edit') && (
                  <button className="btn btn-ghost btn-sm" onClick={() => onEdit(m)}>تعديل</button>
                )}
                {k && can('clearance.delete') && (
                  <button
                    className="btn btn-ghost btn-sm" style={{ color: 'var(--debit)' }} disabled={del.isPending}
                    onClick={() => {
                      const msg = m.groupId
                        ? 'حذف التخليص النقدي؟ سيُحذف المصروف والدفعة معاً، ويرجع المبلغ للخزنة.'
                        : 'حذف هذه الحركة؟ ستُحذف من حساب المكتب ومن الخزنة.';
                      if (window.confirm(msg)) del.mutate(m.id);
                    }}
                  >حذف</button>
                )}
              </td>
            </tr>
          );
        })}
        {!rows.length && <tr><td colSpan={cols} className="empty">لا توجد حركات في هذه الفترة</td></tr>}
      </tbody>
    </table>
  );
}

/* ── كشف حساب مكتب ────────────────────────────────────────────────── */
function OfficeStatement({ id, onBack, agents }: { id: string; onBack: () => void; agents: ClearanceAgent[] }) {
  const { can } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [form, setForm] = useState<Kind | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const { data, isLoading } = useClearanceStatement(id, { from: from || undefined, to: to || undefined });
  const archived = !!data?.agent.hidden;
  const toggle = (k: Kind) => setForm(form === k ? null : k);

  return (
    <>
      <div className="toolbar no-print" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>→ رجوع لمكاتب التخليص</button>
        {!archived && can('clearance.expense') && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => toggle('vehicle')}>{form === 'vehicle' ? '× إلغاء' : '+ تخليص عربية'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => toggle('cash')}>{form === 'cash' ? '× إلغاء' : '+ تخليص نقدي'}</button>
          </>
        )}
        {!archived && can('clearance.pay') && (
          <button className="btn btn-primary btn-sm" onClick={() => toggle('pay')}>{form === 'pay' ? '× إلغاء' : '+ دفعة للمكتب'}</button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>🖨 طباعة</button>
        <span className="muted" style={{ fontSize: 12, marginInlineStart: 'auto' }}>من</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
        <span className="muted" style={{ fontSize: 12 }}>إلى</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
      </div>

      {form && (
        <div className="card no-print" style={{ marginBottom: 12 }}>
          <MovementForm mode={form} agents={agents} fixedAgentId={id} onDone={() => setForm(null)} />
        </div>
      )}

      {isLoading || !data ? <Spinner /> : (
        <>
          <PageTitle
            title={`كشف حساب مكتب التخليص: ${data.agent.name}${archived ? ' (مؤرشف)' : ''}`}
            subtitle={[
              data.agent.phone, data.agent.note,
              data.agent.supplier && `مربوط بالمورد ${data.agent.supplier.name}: التخليص والدفعات تُرحَّل على حسابه`,
            ].filter(Boolean).join(' · ') || undefined}
          />
          <div className="grid stats" style={{ marginBottom: 12 }}>
            <div className="card stat"><div className="lbl">رصيد أول الفترة</div><div className="val num" style={{ fontSize: 19 }}>{EGP(data.opening)}</div></div>
            <div className="card stat"><div className="lbl">تخليص</div><div className="val num" style={{ fontSize: 19 }}>{EGP(data.totals.expenses)}</div></div>
            <div className="card stat"><div className="lbl">دفعات</div><div className="val num" style={{ fontSize: 19 }}>{EGP(data.totals.paid)}</div></div>
            <div className="card stat">
              <div className="lbl">المستحق للمكتب</div>
              <div className="val num" style={{ fontSize: 19, color: data.closing > 0 ? 'var(--debit)' : undefined }}>{EGP(data.closing)}</div>
            </div>
          </div>
          <div className="card tbl-wrap">
            <MovementsTable
              rows={data.rows}
              withBalance
              onEdit={(m) => setEditing({ movement: m, sibling: siblingOf(m, data.rows) })}
            />
          </div>
          <div className="num" style={{ fontWeight: 800, marginTop: 8 }}>المستحق للمكتب في آخر الفترة: {EGP(data.closing)}</div>
        </>
      )}

      {editing && <EditMovementModal editing={editing} agents={agents} onClose={() => setEditing(null)} />}
    </>
  );
}

/* ── نافذة ─────────────────────────────────────────────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: '94%', maxWidth: 760, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><b>{title}</b><button className="btn btn-ghost btn-sm" onClick={onClose}>×</button></div>
        {children}
      </div>
    </div>
  );
}

function EditMovementModal({ editing, agents, onClose }: { editing: Editing; agents: ClearanceAgent[]; onClose: () => void }) {
  const k = kindOf(editing.movement);
  if (!k || k === 'cashPay') return null;
  return (
    <Modal title={`تعديل ${KIND_LABEL[k]}`} onClose={onClose}>
      <MovementForm mode={k} agents={agents} editing={editing} onDone={onClose} />
    </Modal>
  );
}

/* ── إضافة / تعديل مكتب ───────────────────────────────────────────── */
function OfficeForm({ agent, onDone, bare }: { agent?: ClearanceAgent; onDone: () => void; bare?: boolean }) {
  const create = useCreateClearanceAgent();
  const update = useUpdateClearanceAgent();
  const [name, setName] = useState(agent?.name ?? '');
  const [phone, setPhone] = useState(agent?.phone ?? '');
  const [note, setNote] = useState(agent?.note ?? '');
  const [supplierId, setSupplierId] = useState(agent?.supplier?.id ?? '');
  const { data: suppliers } = useAllParties('SUPPLIER');
  const [err, setErr] = useState('');
  const pending = create.isPending || update.isPending;

  const save = () => {
    setErr('');
    if (!name.trim()) return setErr('اكتب اسم المكتب');
    const dto = { name: name.trim(), phone: phone.trim(), note: note.trim(), supplierId };
    const opts = { onSuccess: onDone, onError: (e: any) => setErr(e?.message || 'تعذر الحفظ') };
    if (agent) update.mutate({ id: agent.id, dto }, opts);
    else create.mutate(dto, opts);
  };

  return (
    <div className={bare ? undefined : 'card'} style={{ marginBottom: bare ? 0 : 12 }}>
      <div className="form-grid">
        <Field label="اسم المكتب"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="التليفون"><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></Field>
        <Field label="المورد المرتبط (اختياري)">
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} style={selectStyle}>
            <option value="">— بدون مورد —</option>
            {agent?.supplier && !(suppliers?.data ?? []).some((s) => s.id === agent.supplier!.id) && (
              <option value={agent.supplier.id}>{agent.supplier.name}</option>
            )}
            {(suppliers?.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="ملاحظات" full><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <div className="muted" style={{ fontSize: 12.5, padding: '0 16px 10px' }}>
        {supplierId
          ? 'التخليص والدفعات الجديدة تُرحَّل على حساب المورد مباشرة. الحركات السابقة تبقى على حساب المكتب.'
          : 'بدون مورد: الحركات تُرحَّل على حساب المكتب.'}
      </div>
      {err && <div className="err-text" style={{ padding: '0 16px' }}>{err}</div>}
      <div className="toolbar" style={{ padding: '0 16px 14px', marginBottom: 0 }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={pending}>{pending ? '…' : agent ? 'حفظ التعديل' : 'إضافة المكتب'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>إلغاء</button>
      </div>
    </div>
  );
}

/* ── نموذج الحركة: تخليص عربية / تخليص نقدي / دفعة — إضافة أو تعديل ─────────── */
function MovementForm({ mode, agents, fixedAgentId, editing, onDone }: {
  mode: Kind;
  agents: ClearanceAgent[];
  fixedAgentId?: string;
  editing?: Editing;
  onDone: () => void;
}) {
  const addVehicle = useAddClearanceExpense();
  const addCash = useAddCashClearance();
  const pay = usePayClearanceAgent();
  const update = useUpdateClearanceMovement();
  const { data: treasury } = useAllTreasury();
  const { data: categories } = useAllExpenseCategories();
  // Combobox بيفلتر محلياً، فبنجيب دفعة كبيرة مرة واحدة. عربياتنا فقط (خروج من المخزن).
  const { data: manifestsPage } = useManifests({ pageSize: 200 });

  const m = editing?.movement;
  // الدفعة في التخليص النقدي هي الرجل التانية — منها الخزنة وسعر الصرف.
  const payLeg = mode === 'pay' ? m : mode === 'cash' ? editing?.sibling : undefined;

  // المكتب صاحب الحركة — لو مترحّلة على مورد، party هو المورد والمكتب في clearanceAgent.
  const office = m ? m.clearanceAgent ?? m.party : undefined;
  const [agentId, setAgentId] = useState(fixedAgentId ?? office?.id ?? agents[0]?.id ?? '');
  const [date, setDate] = useState(m?.date?.slice(0, 10) ?? todayISO());
  const [manifestId, setManifestId] = useState(m?.manifest?.id ?? '');
  const [treasuryId, setTreasuryId] = useState(payLeg?.treasury?.id ?? '');
  const [amount, setAmount] = useState(
    m ? String(mode === 'pay' ? (m.cashOut || m.debit) : m.credit) : '',
  );
  const [rate, setRate] = useState(payLeg?.exchangeRate ? String(payLeg.exchangeRate) : '');
  const [categoryId, setCategoryId] = useState(m?.category?.id ?? '');
  const [note, setNote] = useState(m?.note ?? '');
  const [err, setErr] = useState('');

  const needsVehicle = mode !== 'pay';
  const needsTreasury = mode !== 'vehicle';
  const tr = (treasury?.data ?? []).find((t) => t.id === treasuryId) as { currency?: 'EGP' | 'USD' } | undefined;
  const isUSD = tr?.currency === 'USD';
  const amt = Number(amount) || 0;
  const r = Number(rate) || 0;

  // عربياتنا + العربية الحالية للحركة (لو برّه أول 200)
  const ours = (manifestsPage?.data ?? []).filter((x) => x.vehicleSource === 'OURS');
  const options = ours.map((x) => ({
    id: x.id,
    name: `كشف ${x.no} — ${[x.vehicleNo, x.trailerNo].filter(Boolean).join(' / ') || 'بدون رقم'} — ${x.clientName} — ${fmtDate(x.date)}`,
  }));
  if (m?.manifest && !options.some((o) => o.id === m.manifest!.id)) {
    options.unshift({ id: m.manifest.id, name: `كشف ${m.manifest.no} — ${vehicleOf(m.manifest)} — ${m.manifest.clientName}` });
  }
  // المكتب الحالي للحركة يفضل في القائمة حتى لو مؤرشف
  const agentOptions = office && !agents.some((a) => a.id === office.id) ? [{ id: office.id, name: office.name }, ...agents] : agents;
  // جديد: يُرحَّل على المورد المربوط حالياً. تعديل: يبقى على حسابه إلا لو تغيّر المكتب.
  const supplier = editing && agentId === office?.id
    ? (m?.party?.role === 'SUPPLIER' ? m.party : null)
    : agents.find((a) => a.id === agentId)?.supplier ?? null;

  const pending = addVehicle.isPending || addCash.isPending || pay.isPending || update.isPending;
  const opts = { onSuccess: onDone, onError: (e: any) => setErr(e?.message || 'تعذر الحفظ') };

  const save = () => {
    setErr('');
    if (!agentId) return setErr('اختر مكتب التخليص');
    if (needsVehicle && !manifestId) return setErr('اختر العربية');
    if (needsTreasury && !treasuryId) return setErr('اختر الخزنة');
    if (!amt) return setErr('اكتب المبلغ');
    if (isUSD && !r) return setErr('خزنة دولار: اكتب سعر الصرف');
    const rateDto = isUSD ? { rate: r } : {};

    if (editing) {
      return update.mutate({
        id: m!.id,
        dto: {
          date, amount: amt, note: note.trim(),
          ...(fixedAgentId ? {} : { agentId }),
          ...(needsVehicle ? { manifestId, categoryId } : {}),
          ...(needsTreasury ? { treasuryId, ...rateDto } : {}),
        },
      }, opts);
    }
    const base = { agentId, date, amount: amt, note: note.trim() || undefined };
    if (mode === 'vehicle') addVehicle.mutate({ ...base, manifestId, categoryId: categoryId || undefined }, opts);
    else if (mode === 'cash') addCash.mutate({ ...base, manifestId, categoryId: categoryId || undefined, treasuryId, ...rateDto }, opts);
    else pay.mutate({ ...base, treasuryId, ...rateDto }, opts);
  };

  const amountLabel =
    mode === 'pay' ? `المبلغ${isUSD ? ' ($)' : ' (ج.م)'}`
    : 'المبلغ (ج.م)';
  const hint =
    mode === 'vehicle' ? 'المبلغ يُضاف على حساب المكتب، ويظهر في تكاليف شحن العربية.'
    : mode === 'cash' ? 'المبلغ يُدفع من الخزنة الآن ويظهر في تكاليف شحن العربية. رصيد المكتب لا يتغيّر.'
    : 'الدفعة تنزل من المستحق للمكتب. يمكن أن تكون عن أكثر من عربية.';

  return (
    <div>
      <div className="muted" style={{ fontSize: 12.5, padding: '12px 16px 0' }}>{hint}</div>
      {supplier && (
        <div style={{ fontSize: 12.5, padding: '4px 16px 0', fontWeight: 700 }}>
          المكتب مربوط بالمورد {supplier.name}، والحركة تُرحَّل على حساب المورد.
        </div>
      )}
      <div className="form-grid">
        {!fixedAgentId && (
          <Field label="مكتب التخليص">
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} style={selectStyle}>
              {agentOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {needsVehicle && (
          <Field label="العربية" full>
            <Combobox options={options} value={manifestId} onChange={setManifestId} placeholder="اكتب رقم الكشف أو رقم العربية أو اسم العميل…" />
          </Field>
        )}
        {needsTreasury && (
          <Field label="من خزنة">
            <Combobox options={treasury?.data ?? []} value={treasuryId} onChange={setTreasuryId} placeholder="اختر الخزنة" />
          </Field>
        )}
        <Field label={amountLabel}><MoneyInput value={amount} onChange={setAmount} placeholder="0.00" /></Field>
        {needsTreasury && isUSD && (
          <Field label="سعر صرف الدولار (ج.م لكل $)">
            <MoneyInput value={rate} onChange={setRate} placeholder="مثلاً 50" />
            {amt > 0 && r > 0 && (
              <div className="muted num" style={{ fontSize: 12, marginTop: 4 }}>
                {mode === 'pay'
                  ? <>ينزل من رصيد المكتب: {EGP(amt * r)} ج.م</>
                  : <>يخرج من الخزنة: {(amt / r).toFixed(2)} $</>}
              </div>
            )}
          </Field>
        )}
        {needsVehicle && (
          <Field label="البند (اختياري)">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={selectStyle}>
              <option value="">— بدون بند —</option>
              {(categories?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="البيان (اختياري)" full>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'pay' ? 'دفعة عن عدة عربيات…' : 'رسوم جمركية / أرضيات / أتعاب…'} />
        </Field>
      </div>
      {err && <div className="err-text" style={{ padding: '0 16px' }}>{err}</div>}
      <div className="toolbar" style={{ padding: '0 16px 14px', marginBottom: 0 }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={pending}>
          {pending ? '…' : editing ? 'حفظ التعديل' : mode === 'pay' ? 'تسجيل الدفعة' : mode === 'cash' ? 'تسجيل التخليص النقدي' : 'ترحيل على المكتب'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>إلغاء</button>
      </div>
    </div>
  );
}
