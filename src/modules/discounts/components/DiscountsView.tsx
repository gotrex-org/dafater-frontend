'use client';

import { useState } from 'react';
import { EGP, fmtDate, todayISO } from '@/lib/format';
import { useTableState } from '@/lib/useTableState';
import { useAuth } from '@/lib/auth';
import { confirmCascadeDelete } from '@/lib/cascadeDelete';
import { PageTitle, DataTable, SearchInput, Field, MoneyInput, type Column } from '@/components/common';
import { useAllParties } from '../../parties/hooks';
import { PartyCombobox } from '../../invoices/components/PartyCombobox';
import { useDiscounts, useCreateDiscount, useDeleteDiscount } from '../hooks';
import type { Discount } from '../dtos';

export function DiscountsView() {
  const { can } = useAuth();
  const { data: clients } = useAllParties('CLIENT');
  const { data: suppliers } = useAllParties('SUPPLIER');
  const allParties = [...(clients?.data ?? []), ...(suppliers?.data ?? [])];

  const [search, setSearch] = useState('');
  const { page, setPage, pageSize, setPageSize } = useTableState();
  const { data, isLoading } = useDiscounts({ page, pageSize, search: search || undefined });
  const createD = useCreateDiscount();
  const deleteD = useDeleteDiscount();

  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const selectedParty = allParties.find((p) => p.id === partyId);
  const effectHint = selectedParty
    ? selectedParty.role === 'SUPPLIER'
      ? 'خصم على مورد — يقلّل اللي عليك له (اللي مدين له)'
      : 'خصم لعميل — يقلّل اللي عليه (اللي مدين لك بيه)'
    : '';

  const reset = () => { setPartyId(''); setAmount(''); setNote(''); setError(''); setAdding(false); };

  const save = () => {
    setError('');
    if (!partyId) return setError('اختر الطرف');
    if (!(Number(amount) > 0)) return setError('اكتب مبلغ الخصم');
    createD.mutate(
      { date, partyId, amount: Number(amount), note: note.trim() || undefined },
      { onSuccess: reset, onError: (e: any) => setError(e.message) },
    );
  };

  const handleDelete = (d: Discount) => {
    if (!window.confirm(`حذف الخصم على ${d.party?.name ?? ''} بمبلغ ${EGP(d.amount)}؟`)) return;
    confirmCascadeDelete(deleteD, d.id);
  };

  const columns: Column<Discount>[] = [
    { header: 'التاريخ', cell: (d) => fmtDate(d.date) },
    { header: 'الطرف', cell: (d) => <span><b>{d.party?.name}</b> {d.party?.role === 'SUPPLIER' ? <span className="pill">مورد</span> : <span className="pill">عميل</span>}</span> },
    { header: 'المبلغ', cell: (d) => EGP(d.amount), className: 'num cre' },
    { header: 'البيان', cell: (d) => d.note ?? '', className: 'muted' },
    {
      header: '',
      cell: (d) => can('invoices.delete') ? <button className="btn btn-danger btn-sm" onClick={() => handleDelete(d)} disabled={deleteD.isPending}>حذف</button> : null,
    },
  ];

  return (
    <>
      <div className="toolbar">
        {can('invoices') && <button className="btn btn-primary btn-sm sp" onClick={() => setAdding((v) => !v)}>{adding ? '× إلغاء' : '+ خصم جديد'}</button>}
      </div>

      {adding && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>خصم غير مباشر (مش على فاتورة معيّنة)</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>مثلاً خصم شهري من مورد على مسحوباتك، أو خصم بتديه لعميل.</div>
          <div className="form-grid">
            <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="الطرف"><PartyCombobox parties={allParties} value={partyId} onChange={setPartyId} role="CLIENT" /></Field>
            <Field label="مبلغ الخصم"><MoneyInput value={amount} onChange={setAmount} placeholder="0.00" /></Field>
            <Field label="البيان (اختياري)" full><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="خصم شهري…" /></Field>
          </div>
          {effectHint && <div className="muted" style={{ fontSize: 12 }}>{effectHint}</div>}
          {error && <div className="err-text">{error}</div>}
          <div className="toolbar" style={{ marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={createD.isPending}>حفظ الخصم</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="toolbar" style={{ marginTop: 6 }}>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="بحث باسم الطرف…" />
      </div>
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(d) => d.id}
        loading={isLoading}
        emptyText="لا توجد خصومات"
        meta={data?.meta}
        onPage={setPage}
        pageSize={pageSize}
        onPageSize={setPageSize}
      />
    </>
  );
}
