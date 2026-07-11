'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { CustomerPortal } from '@/modules/portal/CustomerPortal';
import { UnsavedProvider, useUnsaved } from '@/lib/unsaved';
import { WindowsProvider } from '@/lib/windows';

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  const { isDirty, setDirty } = useUnsaved();
  const router = useRouter();
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isDirty) return;
    e.preventDefault();
    if (window.confirm('هناك بيانات غير محفوظة، هل تريد المغادرة؟')) {
      setDirty(false);
      router.push(href);
    }
  };
  return <Link href={href} className={active ? 'active' : ''} onClick={handleClick}>{label}</Link>;
}

const NAV: { href: string; label: string; view: string }[] = [
  { href: '/dashboard', label: 'لوحة التحكم', view: 'dash' },
  { href: '/entry', label: 'الإدخال اليومي', view: 'entry' },
  { href: '/invoices', label: 'الفواتير', view: 'invoices' },
  { href: '/deals', label: 'البيع الخارجي', view: 'deals' },
  { href: '/manifests', label: 'كشوفات العربيات', view: 'manifests' },
  { href: '/driver-trips', label: 'كشف السائقين', view: 'driver-trips' },
  { href: '/requests', label: 'الطلبيات', view: 'requests' },
  { href: '/ledger', label: 'كشف الحساب', view: 'ledger' },
  { href: '/inventory', label: 'المخازن', view: 'inventory' },
  { href: '/treasury', label: 'الخزنة', view: 'treasury' },
  { href: '/settings', label: 'الإعدادات', view: 'settings' },
  { href: '/audit', label: 'سجل النشاط', view: 'audit' },
  { href: '/today', label: 'تقرير اليوم', view: 'today' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) return <div className="empty">جاري التحميل…</div>;

  const header = (
    <header className="appbar">
      <span className="logo">دفا<b>تر</b></span>
      <div className="userbox">
        <span>أهلاً بك <b>{user.name}</b></span>
        <button className="logout" onClick={() => { logout(); router.replace('/login'); }}>خروج</button>
      </div>
    </header>
  );

  // Customer accounts get a dedicated portal with no staff nav
  if (user.role === 'CUSTOMER') {
    return (
      <>
        {header}
        <main className="page"><CustomerPortal user={user} /></main>
      </>
    );
  }

  // Sections render as normal full pages; editors open as minimizable windows
  // (WindowsProvider) that collapse into the bottom taskbar when minimized.
  return (
    <UnsavedProvider>
      <WindowsProvider>
        {header}
        <nav className="tabs">
          {NAV.filter((n) => can(n.view)).map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} active={pathname.startsWith(n.href)} />
          ))}
        </nav>
        <main className="page">{children}</main>
      </WindowsProvider>
    </UnsavedProvider>
  );
}
