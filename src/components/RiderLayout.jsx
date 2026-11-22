"use client";

import { Navigation, Heart, Plane, TrainFront, Repeat2, Wallet, Menu } from "lucide-react";

import AppShell from "@/components/shell/AppShell";
import "@/styles/rider-mobile.css";

function TransportIcon({ size = 19, strokeWidth = 2 }) {
  return <span className="rider-transport-icon" aria-hidden="true"><Plane size={size} strokeWidth={strokeWidth} /><TrainFront className="rider-transport-train" size={11} strokeWidth={strokeWidth} /></span>;
}

const NAV = [
  { href: "/dashboard", label: "Voyager", icon: Navigation },
  { href: "/favorite", label: "Favori", icon: Heart },
  { href: "/transport", label: "Vols / trains", icon: TransportIcon },
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
