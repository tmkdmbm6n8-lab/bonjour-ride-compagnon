'use client';

import { LayoutDashboard, Route, Car, Users, DollarSign, Inbox, MessagesSquare, Activity, Archive } from 'lucide-react';

import { useEffect } from 'react';
import { registerDriverPush } from '@/lib/native-push';
import AppShell from '@/components/shell/AppShell';

const NAV = [
  { href: '/admin/dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { href: '/admin/monitoring', label: 'Charge du site', icon: Activity },
  { href: '/admin/rides', label: 'Courses', icon: Route },
  { href: '/admin/drivers', label: 'Chauffeurs', icon: Car },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users },
  { href: '/admin/pricing', label: 'Tarification', icon: DollarSign },
  { href: '/admin/support', label: 'Assistance', icon: Inbox },
  { href: '/admin/chat-evidence', label: 'Échanges signalés', icon: MessagesSquare },
  { href: '/admin/support?archive=1', label: 'Archives', icon: Archive },
];

export default function AdminLayout({ children }) {
  useEffect(() => { registerDriverPush({ audience: 'admin' }); }, []);
  return (
    <>
      <AppShell nav={NAV} variant="admin">{children}</AppShell>
    </>
  );
}
