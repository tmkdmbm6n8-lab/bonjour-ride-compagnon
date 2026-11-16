"use client";

import { Gauge, Route as RouteIcon, Wallet, MessagesSquare, Menu } from "lucide-react";
import { useEffect } from "react";
import AppShell from "@/components/shell/AppShell";
import { registerDriverPush } from "@/lib/native-push";

const NAV = [
  { href: "/driver/dashboard", label: "Accueil", icon: Gauge },
  { href: "/driver/discover", label: "Trafic", icon: RouteIcon },
  { href: "/driver/earnings", label: "Revenus", icon: Wallet },
  { href: "/driver/inbox", label: "Inbox", icon: MessagesSquare },
  { href: "/driver/menu", label: "Menu", icon: Menu },
];

export default function DriverLayout({ children }) {
  useEffect(() => {
    registerDriverPush();
  }, []);
  return <AppShell nav={NAV}>{children}</AppShell>;
}
