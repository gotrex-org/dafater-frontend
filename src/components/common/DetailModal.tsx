'use client';

import type { ReactNode } from 'react';

export interface DetailRow { label: string; value: ReactNode; }

/** Small centered modal showing a list of label/value rows (e.g. a transaction). */
export function DetailModal({ title, rows, onClose }: { title: string; rows: DetailRow[]; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>{title}</b>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {rows.map((r, i) => (
            <div key={i} className="mf-info">
              <span className="mf-info-l">{r.label}</span>
              <span className="mf-info-v">{r.value === '' || r.value === null || r.value === undefined ? '—' : r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
