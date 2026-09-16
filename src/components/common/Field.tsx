import type { ReactNode } from 'react';

interface Props {
  label: ReactNode;
  children: ReactNode;
  /** span the full width of a form-grid */
  full?: boolean;
  /** كلاس إضافي على الحقل — لإزاحة أو تعديل موضعي من غير wrapper زيادة */
  className?: string;
}

/** label + control wrapper used inside `.form-grid` forms. */
export function Field({ label, children, full, className }: Props) {
  return (
    <div className={['field', full ? 'full' : '', className ?? ''].filter(Boolean).join(' ')}>
      <label>{label}</label>
      {children}
    </div>
  );
}
