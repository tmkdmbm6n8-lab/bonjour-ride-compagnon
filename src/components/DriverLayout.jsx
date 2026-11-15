'use client';

import { Home, Compass, BarChart3, Mail, Menu } from 'lucide-react';

import AppShell from '@/components/shell/AppShell';

const NAV = [
  { href: '/driver/dashboard', label: 'Accueil', icon: Home },
  { href: '/driver/discover', label: 'Découvrir', icon: Compass },
  { href: '/driver/earnings', label: 'Revenus', icon: BarChart3 },
  { href: '/driver/inbox', label: 'Inbox', icon: Mail },
  { href: '/driver/menu', label: 'Menu', icon: Menu },
];

export default function DriverLayout({ children }) {
  return (
    <>
      <AppShell nav={NAV}>{children}</AppShell>
    </>
  );
}
