'use client';

import { useState } from 'react';
import { EGP, fmtDate } from '@/lib/format';
import { useTableState } from '@/lib/useTableState';
import { useAuth } from '@/lib/auth';
import { PageTitle, DataTable, StatsGrid, StatCard, CollapsibleSection, MoneyInput, type Column } from '@/components/common';
import {
  useAllTreasury, useTreasuryMovements, useExpensesByCategory,
  useCreateTreasury, useUpdateTreasury, useDeleteTreasury,
} from '../hooks';
import { useDeleteTransaction, usePostEntry } from '../../transactions/hooks';
import { ForexView } from '../../forex/components/ForexView';
import { EditTransactionModal } from '../../transactions/components/EditTransactionModal';
import type { TreasuryAccount, TreasuryMovement, ExpenseByCategory } from '../dtos';

const cashIn = (m: TreasuryMovement) => (m.cashIn || 0) + (m.cashIn2 || 0);
const cashOut = (m: TreasuryMovement) => (m.cashOut || 0) + (m.cashOut2 || 0);

type Mode = null | 'add' | 'edit-pick' | 'edit-form' | 'delete-pick';

export function TreasuryView() {
  const { can, user } = useAuth();
  const { data: accounts } = useAllTreasury();
  const { data: byCat } = useExpensesByCategory();
  const [filterTreasuryId, setFilterTreasuryId] = useState('');
  const { page, setPage, pageSize, setPageSize } = useTableState();
  const { data: moves, isLoading } = useTreasuryMovements({ page, pageSize, treasuryId: filterTreasuryId || undefined });

  const [editing, setEditing] = useState<TreasuryMovement | null>(null);
  const deleteTransaction = useDeleteTransaction();

  // treasury management state
  const [mode, setMode] = useState<Mode>(null);
  const [picked, setPicked] = useState<TreasuryAccount | null>(null);
  const [newName, setNewName] = useState('');
  const [newCurrency, setNewCurrency] = useState<'EGP' | 'USD'>('EGP');
  const [newOpening, setNewOpening] = useState('');
  const [editName, setEditName] = useState('');
  const [editCurrency, setEditCurrency] = useState<'EGP' | 'USD'>('EGP');
  const [editOpening, setEditOpening] = useState('');
  const [err, setErr] = useState('');

  const createTreasury = useCreateTreasury();
  const updateTreasury = useUpdateTreasury();
  const deleteTreasury = useDeleteTreasury();

  // settlement state
  const [showSettle, setShowSettle] = useState(false);
  const [settleType, setSettleType] = useState<'deposit' | 'withdraw'>('deposit');
  const [settleTreasuryId, setSettleTreasuryId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [settleErr, setSettleErr] = useState('');
  const postEntry = usePostEntry();

  const resetSettle = () => { setShowSettle(false); setSettleTreasuryId(''); setSettleAmount(''); setSettleNote(''); setSettleErr(''); };

  const submitSettle = () => {
    if (!settleTreasuryId) return setSettleErr('اختر الخزنة');
    const amt = parseFloat(settleAmount);
    if (!amt || amt <= 0) return setSettleErr('أدخل مبلغ صحيح');
    postEntry.mutate(
      { type: settleType, date: new Date().toISOString().slice(0, 10), amount: amt, treasuryId: settleTreasuryId, note: settleNote || undefined },
      { onSuccess: resetSettle, onError: (e: any) => setSettleErr(e.message) },
    );
  };

  const reset = () => { setMode(null); setPicked(null); setNewName(''); setNewCurrency('EGP'); setNewOpening(''); setEditName(''); setEditCurrency('EGP'); setEditOpening(''); setErr(''); };

  const openEdit = (a: TreasuryAccount) => { setPicked(a); setEditName(a.name); setEditCurrency(a.currency); setEditOpening(String(a.opening ?? 0)); setMode('edit-form'); setErr(''); };

  const saveAdd = () => {
    if (!newName.trim()) return setErr('اكتب اسم الخزنة');
    createTreasury.mutate({ name: newName.trim(), currency: newCurrency, opening: Number(newOpening) || 0 }, { onSuccess: reset, onError: (e: any) => setErr(e.message) });
  };

  const saveEdit = () => {
    if (!editName.trim()) return setErr('اكتب الاسم');
    updateTreasury.mutate({ id: picked!.id, dto: { name: editName.trim(), currency: editCurrency, opening: Number(editOpening) || 0 } }, { onSuccess: reset, onError: (e: any) => setErr(e.message) });
  };

  const confirmDelete = (a: TreasuryAccount) => {
    if (!window.confirm(`حذف خزنة "${a.name}"؟ تأكد أنها فارغة وليس فيها حركات.`)) return;
    deleteTreasury.mutate(a.id, { onSuccess: reset, onError: (e: any) => setErr(e.message) });
  };

  const handleDeleteMove = (m: TreasuryMovement, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`حذف حركة "${m.type}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    deleteTransaction.mutate(m.id);
  };

  const accs = accounts?.data ?? [];
  const canManage = can('settings');

  const expenseCols: Column<ExpenseByCategory>[] = [
    { header: 'البند', cell: (c) => c.category },
    { header: 'الإجمالي', cell: (c) => EGP(c.total), className: 'num deb' },
  ];

  const txTreasury = (m: TreasuryMovement) => {
    if (m.treasury && m.treasury2) return `${m.treasury.name} ← ${m.treasury2.name}`;
    return m.treasury?.name ?? m.treasury2?.name ?? '—';
  };

  const moveCols: Column<TreasuryMovement>[] = [
    { header: 'التاريخ', cell: (m) => fmtDate(m.date) },
    { header: 'النوع', cell: (m) => m.type },
    { header: 'الخزنة', cell: txTreasury, className: 'muted' },
    { header: 'البيان', cell: (m) => m.note || m.party?.name || '', className: 'muted' },
    { header: 'داخل', cell: (m) => (cashIn(m) ? EGP(cashIn(m)) : ''), className: 'num cre' },
    { header: 'خارج', cell: (m) => (cashOut(m) ? EGP(cashOut(m)) : ''), className: 'num deb' },
    {
      header: '',
      cell: (m) => !m.invoiceId && !m.dealId && can('entry') ? (
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditing(m); }}>تعديل</button>
          <button className="btn btn-danger btn-sm" onClick={(e) => handleDeleteMove(m, e)} disabled={deleteTransaction.isPending}>حذف</button>
        </div>
      ) : null,
    },
  ];

  return (
    <>
      {editing && <EditTransactionModal txn={editing} onClose={() => setEditing(null)} />}

      <PageTitle title="الخزنة" subtitle="أرصدة الحسابات النقدية بالعملات وحركتها" />

      {/* ── management toolbar ── */}
      {canManage && (
        <>
          {/* main action buttons — always visible */}
          <div className="toolbar">
            <button className={`btn btn-sm ${mode === 'add' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => mode === 'add' ? reset() : (reset(), setMode('add'))}>
              + خزنة جديدة
            </button>
            <button className={`btn btn-sm ${(mode === 'edit-pick' || mode === 'edit-form') ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => (mode === 'edit-pick' || mode === 'edit-form') ? reset() : (reset(), setMode('edit-pick'))}>
              تعديل خزنة
            </button>
            <button className={`btn btn-sm ${mode === 'delete-pick' ? 'btn-danger' : 'btn-ghost'}`}
              onClick={() => mode === 'delete-pick' ? reset() : (reset(), setMode('delete-pick'))}>
              حذف خزنة
            </button>
          </div>

          {/* add form */}
          {mode === 'add' && (
            <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input autoFocus placeholder="اسم الخزنة" value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveAdd(); if (e.key === 'Escape') reset(); }} style={{ flex: 1, minWidth: 140 }} />
              <select value={newCurrency} onChange={(e) => setNewCurrency(e.target.value as 'EGP' | 'USD')}
                style={{ padding: '10px 12px', border: '1.5px solid var(--line)', borderRadius: 10 }}>
                <option value="EGP">جنيه</option>
                <option value="USD">دولار</option>
              </select>
              <MoneyInput value={newOpening} onChange={setNewOpening} placeholder="رصيد افتتاحي" style={{ maxWidth: 140 }} />
              <button className="btn btn-primary btn-sm" onClick={saveAdd} disabled={createTreasury.isPending}>حفظ</button>
              <button className="btn btn-ghost btn-sm" onClick={reset}>إلغاء</button>
              {err && <span className="err-text">{err}</span>}
            </div>
          )}

          {/* pick treasury to edit */}
          {mode === 'edit-pick' && (
            <div className="card" style={{ padding: 14, marginBottom: 12 }}>
              <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>اختر الخزنة التي تريد تعديلها:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {accs.map((a) => (
                  <button key={a.id} className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>
                    {a.name} ({a.currency})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* edit form */}
          {mode === 'edit-form' && picked && (
            <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 13 }}>تعديل:</span>
              <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') reset(); }} style={{ flex: 1, minWidth: 140 }} />
              <select value={editCurrency} onChange={(e) => setEditCurrency(e.target.value as 'EGP' | 'USD')}
                style={{ padding: '10px 12px', border: '1.5px solid var(--line)', borderRadius: 10 }}>
                <option value="EGP">جنيه</option>
                <option value="USD">دولار</option>
              </select>
              <MoneyInput value={editOpening} onChange={setEditOpening} placeholder="رصيد افتتاحي" style={{ maxWidth: 140 }} />
              <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={updateTreasury.isPending}>حفظ</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setMode('edit-pick')}>رجوع</button>
              <button className="btn btn-ghost btn-sm" onClick={reset}>إلغاء</button>
              {err && <span className="err-text">{err}</span>}
            </div>
          )}

          {/* pick treasury to delete */}
          {mode === 'delete-pick' && (
            <div className="card" style={{ padding: 14, marginBottom: 12 }}>
              <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>اختر الخزنة التي تريد حذفها:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {accs.map((a) => (
                  <button key={a.id} className="btn btn-danger btn-sm" onClick={() => confirmDelete(a)} disabled={deleteTreasury.isPending}>
                    {a.name} ({a.currency})
                  </button>
                ))}
              </div>
              {err && <div className="err-text" style={{ marginTop: 8 }}>{err}</div>}
            </div>
          )}
        </>
      )}

      {/* ── settlement panel ── */}
      {(can('entry') || can('treasury.settle')) && (
        <>
          <div className="toolbar" style={{ marginBottom: showSettle ? 0 : undefined }}>
            <button
              className={`btn btn-sm ${showSettle ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setShowSettle((v) => !v); setSettleErr(''); }}
            >
              {showSettle ? '× إلغاء' : '+ إيداع / سحب'}
            </button>
          </div>

          {showSettle && (
            <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={settleType}
                onChange={(e) => setSettleType(e.target.value as 'deposit' | 'withdraw')}
                style={{ padding: '10px 12px', border: '1.5px solid var(--line)', borderRadius: 10 }}
              >
                <option value="deposit">إيداع</option>
                <option value="withdraw">سحب</option>
              </select>
              <select
                value={settleTreasuryId}
                onChange={(e) => setSettleTreasuryId(e.target.value)}
                style={{ padding: '10px 12px', border: '1.5px solid var(--line)', borderRadius: 10, minWidth: 140 }}
              >
                <option value="">اختر الخزنة</option>
                {accs.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="المبلغ"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitSettle(); if (e.key === 'Escape') resetSettle(); }}
                style={{ width: 130 }}
                min={0}
              />
              <input
                placeholder="بيان (اختياري)"
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitSettle(); if (e.key === 'Escape') resetSettle(); }}
                style={{ flex: 1, minWidth: 140 }}
              />
              <button className="btn btn-primary btn-sm" onClick={submitSettle} disabled={postEntry.isPending}>تسجيل</button>
              <button className="btn btn-ghost btn-sm" onClick={resetSettle}>إلغاء</button>
              {settleErr && <span className="err-text">{settleErr}</span>}
            </div>
          )}
        </>
      )}

      {/* ── balance cards (original style) ── */}
      <StatsGrid columns={2}>
        {accs.map((a) => (
          <StatCard key={a.id} variant="blue" label={`${a.name} (${a.currency})`} value={EGP(a.balance)} />
        ))}
      </StatsGrid>

      {(user?.admin || can('treasury.forex')) && (
        <CollapsibleSection title="وسطاء الصرف" defaultOpen={false}>
          <ForexView embedded />
        </CollapsibleSection>
      )}

      {(user?.admin || can('treasury.expenses')) && (
        <CollapsibleSection title="المصروفات حسب البند" defaultOpen={false}>
          <DataTable columns={expenseCols} rows={byCat ?? []} rowKey={(c) => c.categoryId ?? c.category} emptyText="لا يوجد" />
        </CollapsibleSection>
      )}

      {(user?.admin || can('treasury.movements')) && (
        <CollapsibleSection title="كل الحركات النقدية">
          <div className="toolbar" style={{ marginBottom: 8 }}>
            <select
              value={filterTreasuryId}
              onChange={(e) => { setFilterTreasuryId(e.target.value); setPage(1); }}
              style={{ padding: '8px 12px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13, minWidth: 180 }}
            >
              <option value="">كل الخزائن</option>
              {accs.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ))}
            </select>
            {filterTreasuryId && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setFilterTreasuryId(''); setPage(1); }}>× مسح</button>
            )}
          </div>
          <DataTable
            columns={moveCols}
            rows={moves?.data ?? []}
            rowKey={(m) => m.id}
            loading={isLoading}
            emptyText="لا توجد حركات"
            meta={moves?.meta}
            onPage={setPage}
            pageSize={pageSize}
            onPageSize={setPageSize}
          />
        </CollapsibleSection>
      )}
    </>
  );
}
