'use client';

import { useState, type ReactNode } from 'react';

/** A titled section with a ▾/▸ arrow that shows/hides its body. */
export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  right,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  right?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }} onClick={() => setOpen((o) => !o)}>
        <span style={{ display: 'inline-block', fontSize: 13, transition: 'transform .15s', transform: open ? 'none' : 'rotate(-90deg)' }}>▼</span>
        {title}
        {right && <span style={{ marginInlineStart: 'auto' }} onClick={(e) => e.stopPropagation()}>{right}</span>}
      </h2>
      {open && children}
    </div>
  );
}
