'use client';

import { LayoutDashboard, Route, Car, Users, DollarSign, Inbox, Radar } from 'lucide-react';

import AppShell from '@/components/shell/AppShell';

const NAV = [
  { href: '/admin/dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { href: '/admin/rides', label: 'Courses', icon: Route },
  { href: '/admin/drivers', label: 'Chauffeurs', icon: Car },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users },
  { href: '/admin/pricing', label: 'Tarification', icon: DollarSign },
  { href: '/admin/support', label: 'Assistance', icon: Inbox },
  { href: '/admin/alerts', label: 'Signalements', icon: Radar },
];

export default function AdminLayout({ children }) {
  return (
    <>
      <AppShell nav={NAV}>{children}</AppShell>
    </>
  );
}
