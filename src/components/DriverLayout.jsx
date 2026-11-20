"use client";

import {
  Gauge,
  Route as RouteIcon,
  Wallet,
  MessagesSquare,
  Menu,
  QrCode,
  Gem,
  ShieldAlert,
  LogOut,
} from "lucide-react";
import { useEffect, useState, createContext, useContext } from "react";
import Link from "@/lib/archive-navigation";
import useDriverData from "@/hooks/useDriverData";
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

const GoldContext = createContext(null);
export const useDriverGold = () => useContext(GoldContext);
const STANDARD_NAV = [NAV[0], ...NAV.slice(3, 5), { href: "/driver/private-clients", label: "SDGold", icon: Gem }, NAV[5]];

// Cache persistant pour conserver le statut Gold entre les changements d'onglets
let cachedGold = null;
try {
  if (typeof window !== "undefined") {
    const raw = sessionStorage.getItem("sd_driver_gold_cache");
    if (raw) cachedGold = JSON.parse(raw);
  }
} catch {}

export default function DriverLayout({ children }) {
  const { data: goldData } = useDriverData("/api/drivers/me/gold", 15000);

  // Mémoriser le statut dès réception de la réponse serveur
  if (goldData?.gold !== undefined) {
    cachedGold = goldData.gold;
    try {
      sessionStorage.setItem("sd_driver_gold_cache", JSON.stringify(goldData.gold));
    } catch {}
  }

  // Utiliser immédiatement le cache si la requête est en cours
  const gold = goldData?.gold ?? cachedGold;
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
          // Seule une suspension par signalement/modération bloque l'accès ; l'approbation en attente n'est pas une suspension.
          if (d && d.isReportSuspended) {
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
      try {
        await fetch("/api/drivers/me/online-time", { method: "POST" });
      } catch {
        /* A network gap is not counted as confirmed connection time. */
      } finally {
        pending = false;
      }
    };
    heartbeat();
    const timer = setInterval(heartbeat, 30000);
    window.addEventListener("focus", heartbeat);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", heartbeat);
    };
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

  return (
    <GoldContext.Provider value={gold}>
      <AppShell nav={gold?.active ? NAV : STANDARD_NAV} variant="driver">
        {children}
      </AppShell>
    </GoldContext.Provider>
  );
}
