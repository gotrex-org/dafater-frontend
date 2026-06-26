import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  /** optional right-aligned actions (buttons, etc.) */
  actions?: ReactNode;
}

export function PageTitle({ title, subtitle, actions }: Props) {
  if (!actions) {
    return (
      <div className="page-title">
        {title}
        {subtitle && <small>{subtitle}</small>}
      </div>
    );
  }
  return (
    <div className="toolbar" style={{ alignItems: 'flex-start' }}>
      <div className="page-title" style={{ margin: 0 }}>
        {title}
        {subtitle && <small>{subtitle}</small>}
      </div>
      <div className="sp">{actions}</div>
    </div>
  );
}
