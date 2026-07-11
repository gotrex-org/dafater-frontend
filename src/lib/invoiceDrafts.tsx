'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import type { InvoiceDraft } from '@/modules/invoices/draftTypes';
import { InvoiceEditor } from '@/modules/invoices/components/InvoiceEditor';

// Global store for minimized invoice drafts. Because this provider lives at the app
// layout level (above the router outlet), a draft stays alive while the user navigates
// between pages — they can start a فاتورة, minimize it, go check a كشف حساب, then come
// back and finish it. A minimized draft shows as a chip in the bottom dock; clicking it
// reopens the editor as an overlay on top of whatever page is currently showing.
interface DraftsCtx {
  drafts: InvoiceDraft[];
  openId: string | null;
  /** save/update a draft and collapse it into the dock */
  minimize: (d: InvoiceDraft) => void;
  /** reopen a minimized draft as an overlay editor */
  restore: (id: string) => void;
  /** remove a draft entirely (finished or thrown away) */
  discard: (id: string) => void;
}

const Ctx = createContext<DraftsCtx | null>(null);

export function useInvoiceDrafts() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useInvoiceDrafts must be used within InvoiceDraftsProvider');
  return ctx;
}

export function InvoiceDraftsProvider({ children }: { children: React.ReactNode }) {
  const [drafts, setDrafts] = useState<InvoiceDraft[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const minimize = useCallback((d: InvoiceDraft) => {
    setDrafts((list) => {
      const idx = list.findIndex((x) => x.id === d.id);
      if (idx === -1) return [...list, d];
      const next = [...list];
      next[idx] = d;
      return next;
    });
    setOpenId(null);
  }, []);

  const restore = useCallback((id: string) => setOpenId(id), []);

  const discard = useCallback((id: string) => {
    setDrafts((list) => list.filter((x) => x.id !== id));
    setOpenId((cur) => (cur === id ? null : cur));
  }, []);

  const open = openId ? drafts.find((d) => d.id === openId) ?? null : null;

  return (
    <Ctx.Provider value={{ drafts, openId, minimize, restore, discard }}>
      {children}

      {/* The restored draft, floating over the current page */}
      {open && (
        <div className="draft-overlay">
          <div className="draft-overlay-inner">
            <InvoiceEditor
              key={open.id}
              kind={open.kind}
              initialDraft={open}
              onMinimize={minimize}
              onClose={() => discard(open.id)}
              onUpdated={() => discard(open.id)}
            />
          </div>
        </div>
      )}

      {/* Dock of minimized drafts — hidden while one is open as an overlay */}
      {drafts.length > 0 && !open && (
        <div className="draft-dock">
          {drafts.map((d) => (
            <div key={d.id} className="draft-chip" title={d.title}>
              <button className="draft-chip-open" onClick={() => restore(d.id)}>
                <span className="draft-chip-icon">🧾</span>
                <span className="draft-chip-label">{d.title}</span>
              </button>
              <button className="draft-chip-x" title="إلغاء المسودة" onClick={() => discard(d.id)}>×</button>
            </div>
          ))}
        </div>
      )}
    </Ctx.Provider>
  );
}
