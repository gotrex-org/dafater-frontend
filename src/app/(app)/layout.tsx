'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { CustomerPortal } from '@/modules/portal/CustomerPortal';
import { UnsavedProvider } from '@/lib/unsaved';
import { WindowsProvider, useWindows } from '@/lib/windows';
import { SECTIONS, sectionByHref, type SectionDef } from '@/lib/sections';

// The staff app is a "desktop": each section is a window. The top bar opens/focuses windows
// instead of swapping the page, so you can leave a half-filled screen, open another section,
// and come back to it exactly as you left it. Content is rendered by WindowsProvider (mounted
// at the root and kept alive), so route children are intentionally not rendered here.
function Desktop({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const { can } = useAuth();
  const { open, foregroundId } = useWindows();
  const pathname = usePathname();
  const router = useRouter();

  const openSection = (s: SectionDef) =>
    open({ id: s.view, title: s.label, size: 'lg', render: () => <s.Component /> });

  // Any navigation (nav click, dashboard tile, login redirect, direct URL) maps to opening
  // that section's window. open() is idempotent — it focuses an already-open window.
  useEffect(() => {
    const s = sectionByHref(pathname);
    if (s) openSection(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const navSections = SECTIONS.filter((s) => s.nav && can(s.view));

  return (
    <>
      <header className="appbar">
        <span className="logo">دفا<b>تر</b></span>
        <div className="userbox">
          <span>أهلاً بك <b>{userName}</b></span>
          <button className="logout" onClick={onLogout}>خروج</button>
        </div>
      </header>
      <nav className="tabs">
        {navSections.map((s) => (
          <button
            key={s.view}
            className={foregroundId === s.view ? 'active' : ''}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => { openSection(s); router.push(s.href); }}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <main className="page desktop-bg">
        <div className="desktop-hint">اختر قسمًا من الأعلى — كل قسم يفتح كنافذة تقدر تصغّرها وترجع لها.</div>
      </main>
    </>
  );
}

export default function AppLayout() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) return <div className="empty">جاري التحميل…</div>;

  // Customer accounts get a dedicated portal with no staff desktop
  if (user.role === 'CUSTOMER') {
    return (
      <>
        <header className="appbar">
          <span className="logo">دفا<b>تر</b></span>
          <div className="userbox">
            <span>أهلاً بك <b>{user.name}</b></span>
            <button className="logout" onClick={() => { logout(); router.replace('/login'); }}>خروج</button>
          </div>
        </header>
        <main className="page"><CustomerPortal user={user} /></main>
      </>
    );
  }

  return (
    <UnsavedProvider>
      <WindowsProvider>
        <Desktop userName={user.name} onLogout={() => { logout(); router.replace('/login'); }} />
      </WindowsProvider>
    </UnsavedProvider>
  );
}
