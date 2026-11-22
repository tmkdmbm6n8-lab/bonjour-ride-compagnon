"use client";

import { Navigation, Heart, Plane, Repeat2, Wallet, Menu } from "lucide-react";

import AppShell from "@/components/shell/AppShell";
import "@/styles/rider-mobile.css";

const NAV = [
  { href: "/dashboard", label: "Voyager", icon: Navigation },
  { href: "/favorite", label: "Favori", icon: Heart },
  { href: "/transport", label: "Vols / trains", icon: Plane },
  { href: "/recurring", label: "Récurrents", icon: Repeat2 },
  { href: "/wallet", label: "Portefeuille", icon: Wallet },
  { href: "/profile", label: "Menu", icon: Menu },
];

export default function RiderLayout({ children }) {
  return (
    <>
      <AppShell nav={NAV} variant="rider">
        {children}
      </AppShell>
    </>
  );
}
