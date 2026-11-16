// src/lib/vtc-tracking.js
import { distanceMeters } from "./vtc-geo.js";

export function evaluateDriverProgress(ride, currentDriverLoc, now = Date.now()) {
  if (!ride || ride.status !== "accepted" || !currentDriverLoc) {
    return { canCancelFree: false, warningDriver: false, reason: null };
  }

  const acceptedAt = new Date(ride.accepted_at || ride.updated_at).getTime();
  const elapsedMinutes = (now - acceptedAt) / 60000;

  // Historique des points de suivi stockés dans ride.tracking_snapshots
  const snapshots = ride.tracking_snapshots || [];
  const initialLoc = snapshots[0]?.loc || ride.driver_initial_loc;

  // 1. Détection d'immobilité : < 60 mètres après 5 minutes
  if (initialLoc && elapsedMinutes >= 5) {
    const totalDistMoved = distanceMeters(initialLoc, currentDriverLoc);
    if (totalDistMoved < 60) {
      return {
        canCancelFree: true,
        reason: "driver_immobile",
        label: "Le chauffeur ne se déplace pas (immobile depuis 5 min).",
      };
    }
  }

  // 2. Détection de mauvaise direction / éloignement
  const pickup = ride.pickup?.loc;
  if (!pickup) return { canCancelFree: false, warningDriver: false, reason: null };

  const currentDistToPickup = distanceMeters(currentDriverLoc, pickup);
  const initialDistToPickup = initialLoc ? distanceMeters(initialLoc, pickup) : currentDistToPickup;

  // Si après 4 minutes il s'est éloigné de plus de 200m ou n'a pas progressé
  const notProgressing = currentDistToPickup >= initialDistToPickup - 100;

  if (elapsedMinutes >= 4 && notProgressing) {
    // Si la période d'avertissement de 3 min est passée (total >= 7 min sans progrès)
    if (elapsedMinutes >= 7) {
      return {
        canCancelFree: true,
        reason: "driver_wrong_direction_timeout",
        label: "Le chauffeur s'éloigne du lieu de rendez-vous.",
      };
    }
    // Entre 4 et 7 minutes : alerte chauffeur en cours
    return {
      canCancelFree: false,
      warningDriver: true,
      graceRemainingSeconds: Math.max(0, Math.round((7 - elapsedMinutes) * 60)),
    };
  }

  return { canCancelFree: false, warningDriver: false, reason: null };
}
