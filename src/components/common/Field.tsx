import type { ReactNode } from 'react';

interface Props {
  label: ReactNode;
  children: ReactNode;
  /** span the full width of a form-grid */
  full?: boolean;
}

/** label + control wrapper used inside `.form-grid` forms. */
export function Field({ label, children, full }: Props) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}
