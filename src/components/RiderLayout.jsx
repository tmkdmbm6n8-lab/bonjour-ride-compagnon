import DriverReturnBar from '@/components/shell/DriverReturnBar';
"use client";

import { Navigation, Clock, Wallet, UserRound } from "lucide-react";

import AppShell from "@/components/shell/AppShell";

const NAV = [
  { href: "/dashboard", label: "Voyager", icon: Navigation },
  { href: "/rides", label: "Mes courses", icon: Clock },
  { href: "/wallet", label: "Portefeuille", icon: Wallet },
  { href: "/profile", label: "Profil", icon: UserRound },
];

export default function RiderLayout({ children }) {
  return (
    <>
      <AppShell nav={NAV} variant="rider">
        <DriverReturnBar/>
        {children}
      </AppShell>
    </>
  );
}
