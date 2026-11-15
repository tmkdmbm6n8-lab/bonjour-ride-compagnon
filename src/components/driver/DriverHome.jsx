"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/archive-fetch";
import Link from "@/lib/archive-navigation";
import {
  ShieldCheck,
  SlidersHorizontal,
  Search,
  LocateFixed,
  BarChart3,
  Wallet,
  PawPrint,
  Power,
  Car,
  FileText,
  ChevronRight,
} from "lucide-react";
import MapView from "@/components/ArchiveMap";
import PlaceSearch from "@/components/maps/PlaceSearch";
import Modal from "@/components/ui/Modal";
import { money } from "@/components/ui/bits";
import useGeolocation from "@/hooks/useGeolocation";
import { KovaIcon } from "@/components/brand/KovaLogo";

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
  onWaybill,
}) {
  const [recenterKey, setRecenterKey] = useState(0);
  const [today, setToday] = useState(null);
  const [balance, setBalance] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchedPoint, setSearchedPoint] = useState(null);
  const { position: localPosition } = useGeolocation({ watch: false });
  const mapCenter = searchedPoint || position || localPosition || center;

  useEffect(() => {
    let alive = true;
    apiFetch("/api/drivers/me/earnings")
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

  const recenter = () => {
    setSearchedPoint(null);
    setRecenterKey((k) => k + 1);
  };

  const statusText = loading
    ? "Connexion…"
    : online
      ? isConnected
        ? "En veille · Prêt pour une course"
        : "Reconnexion au réseau…"
      : "Véhicule stationné · Hors ligne";

  return (
    <div className={`drv-cockpit-root ${online ? "is-online" : ""}`}>
      {/* ── Carte plein écran immersive ── */}
      <div className="drv-cockpit-map">
        <MapView key={recenterKey} center={mapCenter} zoom={13} userPosition={position || localPosition || undefined} />
      </div>

      {/* ── Îlot dynamique supérieur (verre dépoli) ── */}
      <header className="drv-cockpit-island">
        <div className="drv-island-left">
          <KovaIcon size={26} />
          <div className="drv-island-brand">
            <strong>StrasDrive</strong>
            <span className={`drv-island-badge ${online ? "active" : ""}`}>
              <i /> {online ? "EN SERVICE" : "HORS SERVICE"}
            </span>
          </div>
        </div>

        <div className="drv-island-actions">
          <button className="drv-island-btn" onClick={recenter} aria-label="Recentrer">
            <LocateFixed size={18} />
          </button>
          <button className="drv-island-btn" onClick={() => setSearchOpen(true)} aria-label="Rechercher">
            <Search size={18} />
          </button>
          <Link href="/driver/preferences" className="drv-island-btn" aria-label="Réglages">
            <SlidersHorizontal size={18} />
          </Link>
          <Link href="/driver/profile" className="drv-island-btn" aria-label="Sécurité">
            <ShieldCheck size={18} />
          </Link>
        </div>
      </header>

      {/* ── Dock de contrôle bas (style Tesla) ── */}
      <div className="drv-cockpit-dock">
        {/* Statut & recherche */}
        <div className="drv-dock-status">
          <span className="drv-dock-pulse" />
          <p>{statusText}</p>
          <button onClick={onWaybill} className="drv-dock-link" aria-label="Feuille de route">
            <FileText size={16} /> Feuille de route
          </button>
        </div>

        {/* Métriques clés en capsules épurées */}
        <div className="drv-dock-metrics">
          <Link href="/driver/earnings" className="drv-metric-card">
            <span className="drv-metric-label">
              <BarChart3 size={14} /> Aujourd'hui
            </span>
            <strong className="drv-metric-val">{today ? money(today.earnings) : "0,00 €"}</strong>
          </Link>
          <Link href="/driver/wallet" className="drv-metric-card">
            <span className="drv-metric-label">
              <Wallet size={14} /> Portefeuille
            </span>
            <strong className="drv-metric-val">{balance !== null ? money(balance) : "—"}</strong>
          </Link>
          {!needsVehicle && (
            <button className="drv-metric-card pet-card" onClick={onTogglePet} disabled={togglingPet}>
              <span className="drv-metric-label">
                <PawPrint size={14} /> StrasDrive Pet
              </span>
              <strong className="drv-metric-val">{acceptsPet ? "Activé" : "Désactivé"}</strong>
            </button>
          )}
        </div>

        {/* Bouton de commande principal */}
        <div className="drv-dock-cta">
          {needsVehicle ? (
            <Link href="/driver/profile" className="drv-cockpit-btn vehicle-btn">
              <Car size={20} />
              <span>Associer un véhicule</span>
            </Link>
          ) : (
            <button
              className={`drv-cockpit-btn ${online ? "online" : "offline"}`}
              onClick={onToggle}
              disabled={busy || loading}
            >
              <Power size={20} />
              <span>{busy ? "Traitement…" : online ? "Passer hors ligne" : "Passer en ligne"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal recherche de lieu */}
      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Explorer la zone" keyboardSafe>
        <PlaceSearch
          value={searchText}
          onChangeText={setSearchText}
          onSelect={(point) => {
            setSearchedPoint(point);
            setRecenterKey((k) => k + 1);
            setSearchOpen(false);
          }}
          bias={position || localPosition || center}
          autoFocus
        />
      </Modal>
    </div>
  );
}
