"use client";

import { useEffect, useState } from "react";
import Link from "@/lib/archive-navigation";
import {
  ShieldCheck,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  LocateFixed,
  ArrowRight,
  ChevronRight,
  BarChart3,
  Wallet,
  PawPrint,
  Power,
  Car,
} from "lucide-react";
import MapView from "@/components/ArchiveMap";
import Modal from "@/components/ui/Modal";
import { money } from "@/components/ui/bits";
import { NAV_APPS } from "@/lib/navigation";

/**
 * Accueil chauffeur (aucune course en cours) : titre hors ligne / en ligne,
 * carte arrondie, opportunités et gros bouton « Passer en ligne ».
 */
export default function DriverHome({
  loading,
  online,
  busy,
  isConnected,
  needsVehicle,
  position,
  center,
  onToggle,
  acceptsPet,
  togglingPet,
  onTogglePet,
  navApp,
  onChooseNavApp,
  navAuto,
  onToggleNavAuto,
}) {
  const [expanded, setExpanded] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [today, setToday] = useState(null);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/drivers/me/earnings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setToday(d.today || null);
        setBalance(d.wallet?.balance ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [online]);

  const title = needsVehicle ? "Vous y êtes presque" : online ? "Vous êtes en ligne" : "Vous êtes hors ligne";
  const subtitle = needsVehicle
    ? "Ajoutez votre véhicule pour commencer"
    : online
      ? isConnected
        ? "Recherche de courses…"
        : "Reconnexion…"
      : "Prêt à partir ?";

  return (
    <div className="drv-home">
      <div className="drv-home-inner">
        <div className="drv-top">
          <Link href="/driver/profile" className="drv-round" aria-label="Sécurité et documents">
            <ShieldCheck size={24} style={{ color: "var(--gold-500)" }} />
          </Link>
          <button type="button" className="drv-round" aria-label="Préférences de conduite" onClick={() => setPrefsOpen(true)}>
            <SlidersHorizontal size={22} />
          </button>
        </div>

        <h1 className="drv-title">{loading ? "…" : title}</h1>
        <p className="drv-sub">
          {online && !needsVehicle && <span className="drv-live-dot" aria-hidden="true" />}
          {subtitle}
        </p>

        <div className={`drv-map ${expanded ? "expanded" : ""}`}>
          <MapView
            key={recenterKey}
            center={center}
            zoom={12.5}
            userPosition={position || undefined}
          />
          <button
            type="button"
            className="drv-map-btn left"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Réduire la carte" : "Agrandir la carte"}
          >
            {expanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <button
            type="button"
            className="drv-map-btn right"
            onClick={() => setRecenterKey((k) => k + 1)}
            aria-label="Recentrer sur ma position"
          >
            <LocateFixed size={21} />
          </button>
        </div>

        <div className="drv-section-head">
          <h2>Opportunités</h2>
          <Link href="/driver/earnings" className="drv-round sm" aria-label="Voir mes revenus">
            <ArrowRight size={20} />
          </Link>
        </div>

        <div className="drv-list">
          <Link href="/driver/earnings" className="drv-row">
            <BarChart3 size={20} />
            <span className="drv-row-label">Revenus du jour</span>
            <span className="drv-row-value mono-nums">
              {today ? `${money(today.earnings)} · ${today.trips} course${today.trips > 1 ? "s" : ""}` : "—"}
            </span>
            <ChevronRight size={18} className="drv-row-chev" />
          </Link>
          <Link href="/driver/wallet" className="drv-row">
            <Wallet size={20} />
            <span className="drv-row-label">Portefeuille</span>
            <span className="drv-row-value mono-nums">{balance != null ? money(balance) : "—"}</span>
            <ChevronRight size={18} className="drv-row-chev" />
          </Link>
          {!needsVehicle && (
            <button type="button" className="drv-row" onClick={onTogglePet} disabled={togglingPet}>
              <PawPrint size={20} style={{ color: acceptsPet ? "var(--gold-500)" : undefined }} />
              <span className="drv-row-label">StrasDrive Pet</span>
              <span className={`drv-switch ${acceptsPet ? "on" : ""}`} role="switch" aria-checked={acceptsPet}>
                {togglingPet ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <span className="knob" />}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="drv-cta-wrap">
        {needsVehicle ? (
          <Link href="/driver/profile" className="drv-cta">
            <Car size={24} /> Ajouter mon véhicule
          </Link>
        ) : (
          <button
            type="button"
            className={`drv-cta ${online ? "online" : ""}`}
            onClick={onToggle}
            disabled={busy || loading}
            aria-pressed={online}
          >
            {busy ? (
              <span className="spinner" />
            ) : (
              <>
                <Power size={24} /> {online ? "Passer hors ligne" : "Passer en ligne"}
              </>
            )}
          </button>
        )}
      </div>

      <Modal open={prefsOpen} onClose={() => setPrefsOpen(false)} title="Préférences de conduite">
        <div className="flex items-center justify-between mb-4" style={{ gap: 12 }}>
          <div>
            <div className="small" style={{ fontWeight: 700 }}>StrasDrive Pet</div>
            <div className="tiny muted">Accepter les passagers avec animal de compagnie</div>
          </div>
          <button
            type="button"
            className={`btn btn-sm ${acceptsPet ? "btn-primary" : "btn-secondary"}`}
            onClick={onTogglePet}
            disabled={togglingPet}
          >
            {togglingPet ? <span className="spinner" /> : acceptsPet ? "Activé" : "Désactivé"}
          </button>
        </div>
        <div className="small" style={{ fontWeight: 700 }}>Application GPS</div>
        <div className="flex gap-2 mt-2 mb-3" role="radiogroup" aria-label="Application GPS">
          {Object.entries(NAV_APPS).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={navApp === id}
              className={`btn btn-sm ${navApp === id ? "btn-primary" : "btn-secondary"}`}
              onClick={() => onChooseNavApp(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 small" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={navAuto} onChange={onToggleNavAuto} /> Ouvrir le GPS automatiquement
        </label>
      </Modal>
    </div>
  );
}
