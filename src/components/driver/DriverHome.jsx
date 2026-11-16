"use client";
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/archive-fetch";
import Link from "@/lib/archive-navigation";
import {
  PawPrint,
  Banknote,
  Wrench,
  HelpCircle,
  Phone,
  Power,
  CheckCircle2,
  FileText,
  ShieldCheck,
} from "lucide-react";
import MapView from "@/components/ArchiveMap";
import Modal from "@/components/ui/Modal";
import { money } from "@/components/ui/bits";
import useGeolocation from "@/hooks/useGeolocation";
import { KovaIcon } from "@/components/brand/KovaLogo";
import { RoadAlertButtons, RoadAlertPrompt } from "@/components/driver/RoadAlertControls";

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
  acceptsCash,
  togglingCash,
  onToggleCash,
  onWaybill,
  roadAlerts,
  reporting,
  onReport,
  canReportRadar = false,
}) {
  const [today, setToday] = useState(null);
  const [lastRide, setLastRide] = useState(null);
  const [earningsView, setEarningsView] = useState("today"); // "today" | "last"
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Détection du glissement du doigt sans flèche
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    // Déclenchement uniquement sur glissement horizontal net (> 20px)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
      if (deltaX < 0) {
        // Droite vers la gauche : Recette aujourd'hui
        setEarningsView("today");
      } else {
        // Gauche vers la droite : Dernière course
        setEarningsView("last");
      }
    }
  };

  // Clic ou tap pour basculer facilement
  const handleToggleEarnings = () => {
    setEarningsView((v) => (v === "today" ? "last" : "today"));
  };

  const [helpOpen, setHelpOpen] = useState(false);
  const { position: localPosition } = useGeolocation({ watch: false });
  const mapCenter = position || localPosition || center;

  useEffect(() => {
    let alive = true;
    apiFetch("/api/drivers/me/earnings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setToday(d.today || null);
        const last = d.recentRides?.[0]?.fare?.driverEarnings;
        setLastRide(typeof last === "number" ? last : null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [online]);

  return (
    <div className={`drv-cockpit-root ${online ? "is-online" : ""}`}>
      {/* ── Carte plein écran ── */}
      <div className="drv-cockpit-map">
        <MapView
          center={mapCenter}
          zoom={14}
          userPosition={position || localPosition || undefined}
          followPosition={online && position ? position : undefined}
          alerts={roadAlerts?.alerts}
        />
      </div>

      {/* ── Bandeau supérieur ultra-fin ── */}
      <header className="drv-cockpit-island">
        <div className="drv-island-left">
          <KovaIcon size={24} />
          <div className="drv-island-brand">
            <strong>StrasDrive</strong>
            <span className={`drv-island-badge ${online ? "active" : ""}`}>
              <i /> {online ? "EN LIGNE" : "HORS LIGNE"}
            </span>
          </div>
        </div>

        {/* ── Boutons d'actions rapides (Patte, Espèces, Outil, Aide) ── */}
        <div className="drv-island-actions">
          {/* 1. Bouton Patte de chien (StrasDrive Pet ON / OFF) */}
          <button
            className={`drv-island-btn ${acceptsPet ? "is-active" : ""}`}
            onClick={onTogglePet}
            disabled={togglingPet}
            title={acceptsPet ? "StrasDrive Pet activé" : "Activer StrasDrive Pet"}
            aria-label="StrasDrive Pet"
          >
            <PawPrint size={18} />
          </button>

          {/* 2. Bouton Espèces (Cash ON / OFF à la place de la loupe) */}
          <button
            className={`drv-island-btn ${acceptsCash ? "is-active" : ""}`}
            onClick={onToggleCash}
            disabled={togglingCash}
            title={acceptsCash ? "Courses en espèces acceptées" : "Espèces désactivées"}
            aria-label="Espèces"
          >
            <Banknote size={18} />
          </button>

          {/* 3. Bouton Outil (Ouvre Préférences & Réglages) */}
          <Link
            href="/driver/preferences"
            className="drv-island-btn"
            title="Options & Outils de conduite"
            aria-label="Outils"
          >
            <Wrench size={18} />
          </Link>

          {/* 4. Bouton Point d'interrogation (FAQ & Questions/Réponses) */}
          <button
            className="drv-island-btn"
            onClick={() => setHelpOpen(true)}
            title="Aide & Questions / Réponses"
            aria-label="Aide"
          >
            <HelpCircle size={18} />
          </button>
        </div>
      </header>

      {/* ── Gains du jour / Dernière course avec geste fluide au doigt ── */}
      <div
        className="drv-floating-earnings"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleToggleEarnings}
        role="button"
        tabIndex={0}
        aria-label="Basculer entre la recette du jour et la dernière course"
      >
        <div key={earningsView} className="drv-float-content">
          <span className="drv-float-label">{earningsView === "today" ? "Aujourd'hui" : "Dernière course"}</span>
          <strong className="drv-float-val">
            {earningsView === "today"
              ? today
                ? money(today.earnings)
                : "0,00 €"
              : lastRide != null
                ? money(lastRide)
                : "0,00 €"}
          </strong>
        </div>
      </div>

      {/* ── Signalements police / radar (aussi sans course) ── */}
      {roadAlerts && (
        <>
          <RoadAlertButtons roadAlerts={roadAlerts} reporting={reporting} onReport={onReport} canReportRadar={canReportRadar} className="is-home" />
          <RoadAlertPrompt roadAlerts={roadAlerts} className="is-home" />
        </>
      )}

      {/* ── Bouton GO compact flottant en bas ── */}
      <div className="drv-cockpit-bottom-bar">
        {needsVehicle ? (
          <Link href="/driver/profile" className="drv-go-btn vehicle-needed">
            <span>Véhicule requis</span>
          </Link>
        ) : (
          <button
            className={`drv-go-btn ${online ? "is-online" : "is-offline"}`}
            onClick={onToggle}
            disabled={busy || loading}
            aria-label={online ? "Passer hors ligne" : "Passer en ligne"}
          >
            <span className="drv-go-pulse" />
            <span className="drv-go-text">{busy ? "…" : online ? "HORS LIGNE" : "GO"}</span>
          </button>
        )}
      </div>

      {/* ── Modal Aide & Questions/Réponses ── */}
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Assistance Chauffeur & FAQ">
        <div className="drv-faq-list">
          <div className="drv-faq-item">
            <h4>Comment fonctionne l'attribution des courses ?</h4>
            <p>
              Les courses sont proposées en priorité aux chauffeurs les plus proches du point de prise en charge avec un
              temps d'acceptation dédié.
            </p>
          </div>
          <div className="drv-faq-item">
            <h4>Puis-je refuser les paiements en espèces ?</h4>
            <p>
              Oui, utilisez le bouton Billet en haut à droite pour désactiver ou réactiver les courses en espèces à tout
              moment.
            </p>
          </div>
          <div className="drv-faq-item">
            <h4>Où trouver ma feuille de route ?</h4>
            <p>
              Dès qu'une course est acceptée, le bouton "Feuille de route" s'affiche directement sur votre écran de
              navigation pour justification légale immédiate.
            </p>
          </div>
          <div className="drv-faq-item">
            <h4>Quand sont versés mes gains ?</h4>
            <p>Les virements automatiques sont émis chaque lundi à minuit directement sur votre compte bancaire.</p>
          </div>
          <div className="mt-4 flex gap-2">
            <Link href="/driver/inbox" className="btn btn-secondary flex-1" onClick={() => setHelpOpen(false)}>
              Contacter le support
            </Link>
            <button className="btn btn-primary flex-1" onClick={() => setHelpOpen(false)}>
              Compris
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
