'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { CustomerPortal } from '@/modules/portal/CustomerPortal';
import { UnsavedProvider } from '@/lib/unsaved';
import { WindowsProvider, SectionOutlet, useWindows } from '@/lib/windows';
import { SECTIONS, sectionByHref, type SectionDef } from '@/lib/sections';
import { useReminderDueCount } from '@/modules/reminders/hooks';
import { RemindersView } from '@/modules/reminders/components/RemindersView';

// Sections render as normal full pages inside <SectionOutlet/>, but each is a mounted
// window with a "🗕 تصغير" button — minimizing sends it to the bottom dock with its state
// intact. Route children aren't rendered here; the outlet renders the active section.
function Desktop({ userName, isPrimary, onLogout }: { userName: string; isPrimary: boolean; onLogout: () => void }) {
  const { can } = useAuth();
  const { activateSection, activeSectionId } = useWindows();
  const pathname = usePathname();
  const router = useRouter();
  const { data: due } = useReminderDueCount(isPrimary);
  const [remindersOpen, setRemindersOpen] = useState(false);

  const openSection = (s: SectionDef) =>
    activateSection({ id: s.view, title: s.label, href: s.href, node: <s.Component /> });

  // Any navigation (nav click, dashboard tile, login redirect, direct URL) shows that
  // section's page. activateSection keeps it mounted so its state survives.
  useEffect(() => {
    const s = sectionByHref(pathname);
    if (s) openSection(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const navSections = SECTIONS.filter((s) => s.nav && (s.primaryOnly ? isPrimary : can(s.view)));
  const dueCount = due?.count ?? 0;

  return (
    <>
      <header className="appbar">
        <span className="logo">دفا<b>تر</b></span>
        <div className="userbox">
          {isPrimary && (
            <button
              className="rem-bell"
              title={dueCount > 0 ? `${dueCount} تذكير قريب/مستحق` : 'مفيش تذكيرات قريبة'}
              onClick={() => setRemindersOpen(true)}
            >
              <span className="rem-bell-dot" data-due={dueCount > 0}>{dueCount > 0 ? dueCount : '!'}</span>
            </button>
          )}
          <span>أهلاً بك <b>{userName}</b></span>
          <button className="logout" onClick={onLogout}>خروج</button>
        </div>
      </header>
      <nav className="tabs">
        {navSections.map((s) => (
          <button
            key={s.view}
            className={activeSectionId === s.view ? 'active' : ''}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => { openSection(s); router.push(s.href); }}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <main className="page"><SectionOutlet /></main>

      {remindersOpen && (
        <div className="modal-overlay" onClick={() => setRemindersOpen(false)}>
          <div className="modal" style={{ maxWidth: 720, width: '94%', maxHeight: '86vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><b>التذكيرات</b><button className="btn btn-ghost btn-sm" onClick={() => setRemindersOpen(false)}>×</button></div>
            <div className="modal-body"><RemindersView embedded /></div>
          </div>
        </div>
      )}
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
        <Desktop userName={user.name} isPrimary={!!user.isPrimary} onLogout={() => { logout(); router.replace('/login'); }} />
      </WindowsProvider>
    </UnsavedProvider>
  );
}
