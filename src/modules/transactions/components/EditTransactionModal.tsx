'use client';

import { useRef, useState } from 'react';
import { Field, MoneyInput } from '@/components/common';
import { replaceAmountInNote } from '@/lib/noteAmount';
import { useUpdateTransaction } from '../hooks';

export interface EditableTransaction {
  id: string;
  type: string;
  date: string;
  note?: string | null;
  debit: number;
  credit: number;
  cashIn?: number;
  cashOut?: number;
}

export function EditTransactionModal({ txn, onClose }: { txn: EditableTransaction; onClose: () => void }) {
  const update = useUpdateTransaction();
  const primaryAmt =
    Math.max(Number(txn.debit) || 0, Number(txn.credit) || 0) ||
    Math.max(Number(txn.cashIn) || 0, Number(txn.cashOut) || 0);

  const [date, setDate] = useState(txn.date.slice(0, 10));
  const [amount, setAmount] = useState(String(primaryAmt));
  const [note, setNote] = useState(txn.note ?? '');
  const [error, setError] = useState('');
  // Keep the amount embedded in the البيان in sync as the amount is edited — unless the
  // user manually edits the البيان, in which case we stop touching their text.
  const noteTouched = useRef(false);
  const syncedAmt = useRef(primaryAmt);

  const onAmountChange = (v: string) => {
    setAmount(v);
    if (noteTouched.current) return;
    const newAmt = Number(v) || 0;
    setNote((prev) => {
      const next = replaceAmountInNote(prev, syncedAmt.current, newAmt);
      if (next !== prev) syncedAmt.current = newAmt;
      return next;
    });
  };

  const save = () => {
    setError('');
    // المبلغ لو اتعدّل لقيمة غير صالحة/صفر منبعتوش كـ undefined بصمت — نوقف ونظهر خطأ
    const amtChanged = amount !== String(primaryAmt);
    if (amtChanged && !(Number(amount) > 0)) return setError('اكتب مبلغًا صحيحًا أكبر من صفر');
    update.mutate(
      { id: txn.id, dto: { date, amount: Number(amount) || undefined, note: note || undefined } },
      { onSuccess: onClose, onError: (e: any) => setError(e.message) },
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>تعديل الحركة — {txn.type}</b>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <Field label="التاريخ">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="المبلغ">
            <MoneyInput value={amount} onChange={onAmountChange} placeholder="0.00" />
          </Field>
          <Field label="البيان">
            <input value={note} onChange={(e) => { noteTouched.current = true; setNote(e.target.value); }} />
          </Field>
          {error && <div className="err-text">{error}</div>}
        </div>
        <div className="toolbar" style={{ padding: '12px 16px' }}>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={update.isPending}>
            {update.isPending ? '...' : 'حفظ'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
