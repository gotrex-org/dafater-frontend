'use client';

import { useState, type ReactNode } from 'react';

/**
 * Delete flow for records that other records point at (a party, a product).
 *
 * Try a plain delete first. Nothing attached → it's gone, no question asked. Otherwise
 * the backend answers 409 describing what's attached, and we put the choice on screen:
 *
 *  • «امسح المعاملات معاه»  — cascade. Really deletes the invoices/ledger/movements.
 *  • «شيله وسيب المعاملات» — archive. Every related record stays exactly as it is; the
 *    record itself just leaves the lists and the pickers. This is a hide rather than a
 *    row delete because it has to be: invoices point at the party/product with required,
 *    Restrict columns, so the row can't leave while its paperwork exists.
 */
export interface DeleteRelatedMutation {
  isPending?: boolean;
  mutate: (
    vars: { id: string; cascade?: boolean; archive?: boolean },
    opts?: { onSuccess?: () => void; onError?: (e: any) => void },
  ) => void;
}

interface Conflict {
  id: string;
  label: string;
  message: string;
  canCascade: boolean;
}

export function useDeleteWithRelated(
  mutation: DeleteRelatedMutation,
  opts?: { onSuccess?: () => void; onError?: (e: any) => void },
) {
  const [conflict, setConflict] = useState<Conflict | null>(null);

  const start = (id: string, label: string) => {
    mutation.mutate(
      { id },
      {
        onSuccess: () => { setConflict(null); opts?.onSuccess?.(); },
        onError: (e: any) => {
          // A 409 carrying `canArchive` is the "which kind of delete?" question,
          // not a failure. Anything else is a real error.
          if (e?.status === 409 && e?.body?.canArchive) {
            setConflict({ id, label, message: e.body.message ?? e.message, canCascade: !!e.body.canCascade });
          } else {
            opts?.onError?.(e);
          }
        },
      },
    );
  };

  const choose = (mode: 'cascade' | 'archive') => {
    if (!conflict) return;
    mutation.mutate(
      { id: conflict.id, [mode]: true },
      {
        onSuccess: () => { setConflict(null); opts?.onSuccess?.(); },
        onError: (e: any) => { setConflict(null); opts?.onError?.(e); },
      },
    );
  };

  const modal: ReactNode = conflict ? (
    <div className="modal-overlay" onClick={() => setConflict(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>حذف «{conflict.label}»</b>
          <button className="btn btn-ghost btn-sm" onClick={() => setConflict(null)}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ margin: '4px 0 14px', fontSize: 14.5 }}>{conflict.message}</p>
          <p className="muted" style={{ margin: '0 0 14px', fontSize: 13 }}>
            تحب أعمل إيه بالمعاملات المرتبطة بيه؟
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            <button
              className="btn btn-primary"
              style={{ justifyContent: 'flex-start', textAlign: 'start' }}
              onClick={() => choose('archive')}
              disabled={mutation.isPending}
            >
              سيب المعاملات زي ما هي
            </button>
            <span className="muted" style={{ fontSize: 12.5, marginTop: -4, marginBottom: 4 }}>
              يختفي من كل القوايم والخانات، والفواتير وكشف الحساب القديمة تفضل زي ما هي بالظبط.
            </span>
            {conflict.canCascade && (
              <>
                <button
                  className="btn"
                  style={{ background: 'var(--debit)', color: '#fff', justifyContent: 'flex-start', textAlign: 'start' }}
                  onClick={() => choose('cascade')}
                  disabled={mutation.isPending}
                >
                  امسح المعاملات معاه
                </button>
                <span className="muted" style={{ fontSize: 12.5, marginTop: -4 }}>
                  حذف نهائي — الفواتير والحركات المرتبطة بيه هتتمسح كمان، ومفيش تراجع.
                </span>
              </>
            )}
          </div>
        </div>
        <div className="toolbar" style={{ padding: '12px 16px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setConflict(null)}>إلغاء</button>
        </div>
      </div>
    </div>
  ) : null;

  return { start, modal };
}
