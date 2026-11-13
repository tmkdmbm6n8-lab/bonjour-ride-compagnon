'use client';

import { Gauge, DollarSign, Clock, UserRound, Wallet } from 'lucide-react';

import AppShell from '@/components/shell/AppShell';

const NAV = [
  { href: '/driver/dashboard', label: 'Conduire', icon: Gauge },
  { href: '/driver/earnings', label: 'Revenus', icon: DollarSign },
  { href: '/driver/wallet', label: 'Portefeuille', icon: Wallet },
  { href: '/driver/trips', label: 'Courses', icon: Clock },
  { href: '/driver/profile', label: 'Profil', icon: UserRound },
];

export default function DriverLayout({ children }) {
  return (
    <>
      <AppShell nav={NAV}>{children}</AppShell>
    </>
  );
}
