"use client";

import { Navigation, Heart, CalendarClock, Repeat2, Wallet, Menu } from "lucide-react";

import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import AppShell from "@/components/shell/AppShell";
import { prefetchRiderAssets } from "@/lib/offline-prefetch";
import "@/styles/rider-mobile.css";

const NAV = [
  { href: "/dashboard", label: "Voyager", icon: Navigation },
  { href: "/favorite", label: "Favori", icon: Heart },
  { href: "/transport", label: "Réservation", icon: CalendarClock },
  { href: "/recurring", label: "Récurrents", icon: Repeat2 },
  { href: "/wallet", label: "Portefeuille", icon: Wallet },
  { href: "/profile", label: "Menu", icon: Menu },
];

export default function RiderLayout({ children }) {
  const router = useRouter();
  // Loads every rider tab and its data in the background so the app keeps working without network.
  useEffect(() => {
    const timer = setTimeout(() => { void prefetchRiderAssets(router); }, 300);
    return () => clearTimeout(timer);
  }, [router]);
  return (
    <AppShell nav={NAV} variant="rider">
      {children}
    </AppShell>
  );
}
