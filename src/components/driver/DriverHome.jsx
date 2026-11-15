"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/archive-fetch";
import Link from "@/lib/archive-navigation";
import {
  ShieldCheck,
  SlidersHorizontal,
  Maximize2,
  Search,
  Home,
  LocateFixed,
  ArrowRight,
  ChevronRight,
  BarChart3,
  Wallet,
  PawPrint,
  Power,
  Car,
  List,
  FileText,
  ChevronDown,
  Route,
} from "lucide-react";
import MapView from "@/components/ArchiveMap";
import PlaceSearch from "@/components/maps/PlaceSearch";
import Modal from "@/components/ui/Modal";
import { money } from "@/components/ui/bits";
import useGeolocation from "@/hooks/useGeolocation";

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
  const [expanded, setExpanded] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);
  const [today, setToday] = useState(null);
  const [balance, setBalance] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchedPoint, setSearchedPoint] = useState(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const { position: localPosition } = useGeolocation({ watch: false });
  const mapCenter = searchedPoint || position || localPosition || center;
  useEffect(() => {
    if (online) setExpanded(true);
  }, [online]);
  useEffect(() => {
    if (!expanded) return;
    const escape = (e) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [expanded]);
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
  const title = needsVehicle ? "Vous y êtes presque" : online ? "Vous êtes en ligne" : "Vous êtes hors ligne";
  const status = loading
    ? "Chargement…"
    : online
      ? isConnected
        ? "Recherche de courses"
        : "Reconnexion…"
      : "Vous êtes hors ligne";
  const recenter = () => {
    setSearchedPoint(null);
    setRecenterKey((k) => k + 1);
  };
  return (
    <div
      className={`drv-home driver-reference ${expanded ? "driver-map-mode" : ""} ${online ? "driver-is-online" : ""}`}
    >
      <div className="drv-home-inner">
        <div className="drv-top">
          <Link href="/driver/profile" className="drv-round" aria-label="Sécurité et documents">
            <ShieldCheck size={27} className="driver-shield" />
          </Link>
          <Link href="/driver/preferences" className="drv-round" aria-label="Préférences de conduite">
            <SlidersHorizontal size={27} />
          </Link>
        </div>
        <h1 className="drv-title">{loading ? "…" : title}</h1>
        <p className="drv-sub">
          {needsVehicle ? "Ajoutez votre véhicule pour commencer" : online ? status : "Prêt à partir ?"}
        </p>
        <div className={`drv-map driver-dark-map ${expanded ? "expanded" : ""}`}>
          <MapView
            key={`${recenterKey}-${expanded}`}
            center={mapCenter}
            zoom={12.5}
            userPosition={position || localPosition || undefined}
          />
          {!expanded && (
            <button className="driver-map-open" onClick={() => setExpanded(true)} aria-label="Ouvrir la carte" />
          )}
          <button
            className="drv-map-btn left"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Retour à l’accueil" : "Agrandir la carte"}
          >
            {expanded ? <Home size={25} /> : <Maximize2 size={25} />}
          </button>
          <button
            className="drv-map-btn right"
            onClick={() => setSearchOpen(true)}
            aria-label="Rechercher une adresse sur la carte"
          >
            <Search size={26} />
          </button>
          {expanded && (
            <>
              <Link href="/driver/earnings" className="driver-earnings-pill">
                <span>{today ? money(today.earnings) : "—"}</span>
                <ChevronDown size={18} />
              </Link>
              <div className="driver-map-tools-left">
                <Link href="/driver/profile" className="drv-map-tool" aria-label="Sécurité et documents">
                  <ShieldCheck className="driver-shield" size={28} />
                </Link>
              </div>
              <div className="driver-map-tools-right">
                <button className="drv-map-tool" onClick={recenter} aria-label="Recentrer la carte">
                  <LocateFixed size={25} />
                </button>
                <Link
                  href="/driver/preferences"
                  className="drv-map-tool driver-opportunities-icon"
                  aria-label="Préférences de courses"
                >
                  <Route size={27} />
                </Link>
                <Link href="/driver/earnings" className="drv-map-tool" aria-label="Voir les revenus">
                  <BarChart3 size={27} />
                </Link>
              </div>
              {!online && (
                <button
                  className="driver-go"
                  disabled={busy || loading || needsVehicle}
                  onClick={onToggle}
                  aria-label="Passer en ligne"
                >
                  {busy ? <span className="spinner" /> : "GO"}
                </button>
              )}
            </>
          )}
        </div>
        <div className="driver-home-sections">
          <div className="drv-section-head">
            <h2>Opportunités</h2>
            <Link href="/driver/preferences" className="drv-round sm" aria-label="Préférences de courses">
              <ArrowRight size={24} />
            </Link>
          </div>
          <div className="drv-list">
            <Link href="/driver/earnings" className="drv-row">
              <BarChart3 size={22} />
              <span className="drv-row-label">Revenus</span>
              <span className="drv-row-value">{today ? money(today.earnings) : "—"}</span>
              <ChevronRight size={20} />
            </Link>
            <Link href="/driver/wallet" className="drv-row">
              <Wallet size={22} />
              <span className="drv-row-label">Portefeuille</span>
              <span className="drv-row-value">{balance === null ? "—" : money(balance)}</span>
              <ChevronRight size={20} />
            </Link>
            <button className="drv-row" onClick={onWaybill}>
              <FileText size={22} />
              <span className="drv-row-label">Waybill</span>
              <ChevronRight size={20} />
            </button>
            {!needsVehicle && (
              <button className="drv-row" onClick={onTogglePet} disabled={togglingPet}>
                <PawPrint size={22} />
                <span className="drv-row-label">StrasDrive Pet</span>
                <span className={`drv-switch ${acceptsPet ? "on" : ""}`} role="switch" aria-checked={acceptsPet}>
                  {togglingPet ? <span className="spinner" /> : <span className="knob" />}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="drv-cta-wrap">
        {needsVehicle ? (
          <Link href="/driver/profile" className="drv-cta">
            <Car size={26} />
            Ajouter mon véhicule
          </Link>
        ) : (
          <button className={`drv-cta ${online ? "online" : ""}`} onClick={onToggle} disabled={busy || loading}>
            {busy ? (
              <span className="spinner" />
            ) : (
              <>
                <Power size={26} />
                {online ? "Passer hors ligne" : "Passer en ligne"}
              </>
            )}
          </button>
        )}
      </div>
      {expanded && (
        <div className={`driver-status-panel ${online ? "is-online" : ""}`}>
          <div className="driver-status-row">
            <Link href="/driver/preferences" aria-label="Préférences de conduite">
              <SlidersHorizontal size={26} />
            </Link>
            <span role="status">{status}</span>
            <button onClick={() => setToolsOpen(true)} aria-label="Options de conduite">
              <List size={29} />
            </button>
          </div>
          {!online && (
            <button className="driver-waybill-row" onClick={onWaybill}>
              <FileText size={26} />
              <span>Waybill</span>
            </button>
          )}
        </div>
      )}
      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Rechercher sur la carte" keyboardSafe>
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
      <Modal open={toolsOpen} onClose={() => setToolsOpen(false)} title="Conduite">
        <div className="flex-col gap-3">
          <button
            className="btn btn-secondary"
            onClick={() => {
              setToolsOpen(false);
              onWaybill();
            }}
          >
            <FileText size={20} />
            Réservation préalable · Waybill
          </button>
          {online && (
            <button
              className="btn btn-danger"
              onClick={() => {
                setToolsOpen(false);
                onToggle();
              }}
              disabled={busy}
            >
              Passer hors ligne
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => {
              setToolsOpen(false);
              setExpanded(false);
            }}
          >
            Retour à l’accueil
          </button>
        </div>
      </Modal>
    </div>
  );
}
