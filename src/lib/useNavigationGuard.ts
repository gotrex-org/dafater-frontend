import { useContext, useEffect } from 'react';
import { WindowedContext } from './windowed';

const MSG = 'في بيانات لم تُحفظ — هل تريد المغادرة بدون حفظ؟';

/**
 * Shows a confirm dialog before any anchor-based navigation or browser close
 * when the form has unsaved changes (isDirty=true).
 * Covers: Next.js <Link> clicks in the nav, browser refresh/close.
 */
export function useNavigationGuard(isDirty: boolean) {
  // Inside a minimizable window the guard is intentionally disabled (see windowed.ts).
  const windowed = useContext(WindowedContext);
  useEffect(() => {
    if (!isDirty || windowed) return;

    // Browser close / page refresh
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    // Next.js <Link> renders as <a> — intercept in capture phase before router acts
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]');
      if (!anchor) return;
      const href = (anchor as HTMLAnchorElement).getAttribute('href') ?? '';
      if (!href || href.startsWith('#')) return;
      if (!window.confirm(MSG)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('click', handleClick, true); // capture phase

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('click', handleClick, true);
    };
  }, [isDirty, windowed]);
}
