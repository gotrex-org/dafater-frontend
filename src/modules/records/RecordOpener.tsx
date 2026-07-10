'use client';

import { InvoiceDetailById } from '../invoices/components/InvoiceDetail';
import { DealDetailById } from '../deals/components/DealsView';
import { LedgerDetailById } from '../parties/components/LedgerView';
import { ManifestPrint } from '../manifests/components/ManifestPrint';

// Entities that have a real per-record detail view we can open by uid. Used by the
// activity log and the reports to deep-link a row to "the original record" without
// any URL routing — it swaps the current page for the target's detail component
// (the same full-page-swap idiom the app already uses, e.g. DailyReport → invoice).
const OPENERS: Record<string, (uid: string, onClose: () => void) => JSX.Element> = {
  invoices:  (uid, onClose) => <InvoiceDetailById uid={uid} onBack={onClose} />,
  deals:     (uid, onClose) => <DealDetailById uid={uid} onBack={onClose} />,
  parties:   (uid, onClose) => <LedgerDetailById uid={uid} onBack={onClose} />,
  manifests: (uid, onClose) => <ManifestPrint id={uid} onClose={onClose} />,
};

export function canOpenRecord(entity: string, uid?: string | null): boolean {
  return !!uid && entity in OPENERS;
}

export function RecordOpener({ entity, uid, onClose }: { entity: string; uid: string; onClose: () => void }) {
  const open = OPENERS[entity];
  return open ? open(uid, onClose) : null;
}
