'use client';

import type { ComponentType } from 'react';
import { DashboardView } from '@/modules/dashboard/components/DashboardView';
import { EntryForm } from '@/modules/transactions/components/EntryForm';
import { InvoicesView } from '@/modules/invoices/components/InvoicesView';
import { DealsView } from '@/modules/deals/components/DealsView';
import { ManifestsView } from '@/modules/manifests/components/ManifestsView';
import { DriverTripsView } from '@/modules/driver-trips/components/DriverTripsView';
import { RequestsView } from '@/modules/requests/components/RequestsView';
import { LedgerView } from '@/modules/parties/components/LedgerView';
import { InventoryView } from '@/modules/inventory/components/InventoryView';
import { TreasuryView } from '@/modules/treasury/components/TreasuryView';
import { SettingsView } from '@/modules/settings/components/SettingsView';
import { AuditView } from '@/modules/audit/components/AuditView';
import { DailyReport } from '@/modules/transactions/components/DailyReport';
import { ForexView } from '@/modules/forex/components/ForexView';
import { OrdersView } from '@/modules/orders/components/OrdersView';

// Every app section. `nav` marks the ones shown in the top bar (in this order); `view` is
// the permission key. `primaryOnly` restricts to the owner account. Sections stay mounted
// so their state survives minimizing to the dock.
export interface SectionDef {
  view: string;
  href: string;
  label: string;
  Component: ComponentType;
  nav?: boolean;
  primaryOnly?: boolean;
}

export const SECTIONS: SectionDef[] = [
  { view: 'dash',         href: '/dashboard',    label: 'لوحة التحكم',       Component: DashboardView,  nav: true },
  { view: 'entry',        href: '/entry',        label: 'الإدخال اليومي',    Component: EntryForm,      nav: true },
  { view: 'invoices',     href: '/invoices',     label: 'الفواتير',          Component: InvoicesView,   nav: true },
  { view: 'deals',        href: '/deals',        label: 'البيع الخارجي',     Component: DealsView,      nav: true },
  { view: 'manifests',    href: '/manifests',    label: 'كشوفات العربيات',   Component: ManifestsView,  nav: true },
  { view: 'driver-trips', href: '/driver-trips', label: 'كشف السائقين',      Component: DriverTripsView, nav: true },
  { view: 'requests',     href: '/requests',     label: 'الطلبيات',          Component: RequestsView,   nav: true },
  { view: 'ledger',       href: '/ledger',       label: 'كشف الحساب',        Component: LedgerView,     nav: true },
  { view: 'inventory',    href: '/inventory',    label: 'المخازن',           Component: InventoryView,  nav: true },
  { view: 'treasury',     href: '/treasury',     label: 'الخزنة',            Component: TreasuryView,   nav: true },
  { view: 'settings',     href: '/settings',     label: 'الإعدادات',         Component: SettingsView,   nav: true },
  { view: 'audit',        href: '/audit',        label: 'سجل النشاط',        Component: AuditView,      nav: true },
  { view: 'today',        href: '/today',        label: 'تقرير اليوم',       Component: DailyReport,    nav: true },
  { view: 'forex',        href: '/forex',        label: 'الدولار',           Component: ForexView },
  { view: 'orders',       href: '/orders',       label: 'الطلبيات',          Component: OrdersView },
];

export const sectionByHref = (path: string): SectionDef | undefined =>
  SECTIONS.find((s) => path === s.href || path.startsWith(s.href + '/'));
