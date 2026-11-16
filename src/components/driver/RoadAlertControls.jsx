"use client";
import { Volume2, VolumeX } from "lucide-react";
import { PoliceCapIcon, FrenchRadarIcon } from "@/components/icons/road-alert-icons";

/** Boutons Son / Radar / Police, partagés entre l'accueil chauffeur et l'écran de course. */
export function RoadAlertButtons({ roadAlerts, reporting, onReport, canReportRadar = false, className = "" }) {
  return (
    <div className={`drv-alert-stack ${className}`}>
      <button
        className={`drv-alert-btn is-sound ${roadAlerts.muted ? "is-muted" : ""}`}
        onClick={roadAlerts.toggleMute}
        aria-label={roadAlerts.muted ? "Activer le son des alertes" : "Couper le son des alertes"}
        title={roadAlerts.muted ? "Son coupé" : "Son actif"}
      >
        {roadAlerts.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      {canReportRadar && <button
        className="drv-alert-btn is-radar"
        onClick={() => onReport("radar")}
        disabled={reporting === "radar"}
        aria-label="Signaler un radar"
        title="Signaler un radar"
      >
        <FrenchRadarIcon size={22} />
      </button>}
      <button
        className="drv-alert-btn is-police"
        onClick={() => onReport("police")}
        disabled={reporting === "police"}
        aria-label="Signaler un contrôle de police"
        title="Signaler la police"
      >
        <PoliceCapIcon size={22} />
      </button>
    </div>
  );
}

/** Question « toujours présent ? » posée aux chauffeurs qui passent près d'une patrouille. */
export function RoadAlertPrompt({ roadAlerts, className = "" }) {
  const a = roadAlerts.prompt;
  if (!a) return null;
  return (
    <div className={`drv-alert-confirm ${className}`} role="dialog" aria-live="polite">
      <span className={`drv-alert-confirm-icon is-${a.kind}`}>
        {a.kind === "police" ? <PoliceCapIcon size={20} /> : <FrenchRadarIcon size={20} />}
      </span>
      <p>{a.kind === "police" ? "Contrôle de police toujours présent ?" : "Radar toujours présent ?"}</p>
      <button className="drv-alert-yes" onClick={() => roadAlerts.vote(a.id, true)}>
        Oui
      </button>
      <button className="drv-alert-no" onClick={() => roadAlerts.vote(a.id, false)}>
        Non
      </button>
    </div>
  );
}
