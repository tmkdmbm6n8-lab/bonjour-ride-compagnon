"use client";

import { Gauge, Route as RouteIcon, Wallet, MessagesSquare, Menu, QrCode, ShieldAlert, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "@/lib/archive-navigation";
import AppShell from "@/components/shell/AppShell";
import { registerDriverPush } from "@/lib/native-push";
import { apiFetch as fetch } from "@/lib/archive-fetch";
import { signOut } from "@/lib/archive-auth";

const NAV = [
  { href: "/driver/dashboard", label: "Accueil", icon: Gauge },
  { href: "/driver/private-clients", label: "Clients", icon: QrCode },
  { href: "/driver/discover", label: "Trafic", icon: RouteIcon },
  { href: "/driver/earnings", label: "Revenus", icon: Wallet },
  { href: "/driver/inbox", label: "Inbox", icon: MessagesSquare },
  { href: "/driver/menu", label: "Menu", icon: Menu },
];

export default function DriverLayout({ children }) {
  const [isSuspended, setIsSuspended] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    registerDriverPush();

    // Vérifier l'état de suspension du compte
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/drivers/me");
        if (res.ok) {
          const data = await res.json();
          const d = data.driver;
          // Un chauffeur est suspendu si isApproved est faux (ou s'il a été suspendu par signalement / modération)
          if (d && (d.isApproved === false || d.isReportSuspended)) {
            if (!ignore) setIsSuspended(true);
          }
        }
      } catch {
        // En cas d'erreur réseau, ne pas bloquer
      } finally {
        if (!ignore) setChecked(true);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  // Keep online time observed while using any driver tab, including when stationary.
  useEffect(() => {
    let stopped = false;
    let pending = false;
    const heartbeat = async () => {
      if (stopped || pending) return;
      pending = true;
      try { await fetch('/api/drivers/me/online-time', { method: 'POST' }); }
      catch { /* A network gap is not counted as confirmed connection time. */ }
      finally { pending = false; }
    };
    heartbeat();
    const timer = setInterval(heartbeat, 30000);
    window.addEventListener('focus', heartbeat);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('focus', heartbeat); };
  }, []);

  // Écran de bannissement total : bloque l'accès à toute l'application
  if (isSuspended) {
    return (
      <div className="driver-banned-lockout-screen">
        <div className="driver-banned-card">
          <div className="driver-banned-icon-wrap">
            <ShieldAlert size={56} className="driver-banned-icon" />
          </div>
          <h1>Compte suspendu</h1>
          <p className="driver-banned-message">
            Votre compte a été suspendu définitivement. Si vous pensez qu’il s’agit d’une erreur, contactez
            l’assistance.
          </p>
          <div className="driver-banned-actions">
            <Link href="/contact?topic=driver_support" className="btn btn-primary btn-full">
              Contacter l’assistance
            </Link>
            <button type="button" className="btn btn-secondary btn-full" onClick={() => signOut({ callbackUrl: "/" })}>
              <LogOut size={17} style={{ marginRight: 8 }} />
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <AppShell nav={NAV} variant="driver">{children}</AppShell>;
}
