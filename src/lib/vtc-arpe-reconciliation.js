import { hourlyGuaranteeStatement } from "./vtc-arpe-guarantees";

/**
 * Transforme les courses terminées en données éligibles à la garantie horaire.
 * Les durées sont fondées sur des horodatages réels, jamais sur l'itinéraire estimé.
 * Les données incomplètes sont exclues et signalées pour vérification manuelle.
 * Aucun paiement ni débit n'est effectué ici.
 */
const secondsBetween = (from, to) => {
  if (!from || !to) return null;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 1000;
};

export function prepareHourlyReconciliation(rides, { periodStart, periodEnd } = {}) {
  const start = Date.parse(periodStart);
  const end = Date.parse(periodEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end)
    throw new Error("Période de rapprochement invalide");
  const eligible = [];
  const excluded = [];
  const seen = new Set();
  for (const ride of rides || []) {
    if (!ride?.id || seen.has(ride.id)) {
      excluded.push({ id: ride?.id ?? null, reason: "identifiant absent ou doublon" });
      continue;
    }
    seen.add(ride.id);
    if (ride.status !== "completed" || ride.is_test) continue;
    const completed = Date.parse(ride.completed_at ?? ride.fare?.completedAt);
    if (!Number.isFinite(completed) || completed < start || completed >= end) continue;
    const rideSeconds = secondsBetween(ride.started_at ?? ride.fare?.startedAt, ride.completed_at ?? ride.fare?.completedAt);
    const approachSeconds = secondsBetween(ride.accepted_at ?? ride.fare?.acceptedAt, ride.started_at ?? ride.fare?.startedAt);
    if (rideSeconds === null || approachSeconds === null || ride.fare?.driverEarnings == null || !Number.isFinite(Number(ride.fare.driverEarnings)) || Number(ride.fare.driverEarnings) < 0) {
      excluded.push({ id: ride.id, reason: "horodatages ou rémunération manquants" });
      continue;
    }
    eligible.push({
      rideSeconds,
      approachSeconds,
      advanceBooking: Boolean(ride.is_advance_booking),
      driverEarnings: Number(ride.fare.driverEarnings),
      bonuses: Number(ride.fare?.bonuses || 0),
    });
  }
  return { ...hourlyGuaranteeStatement(eligible), includedCount: eligible.length, excluded, needsReview: excluded.length > 0, readyForPayment: false };
}

/**
 * Prépare un état par chauffeur sans mélanger les rémunérations.
 * Une course sans chauffeur est mise en quarantaine et interdit toute validation automatique.
 * La validation des périodes, des primes et des paiements reste une étape humaine.
 */
export function prepareDriverHourlyReconciliations(rides, period) {
  const byDriver = new Map();
  const unassigned = [];
  for (const ride of rides || []) {
    const driverId = ride?.driver_id;
    if (!driverId) {
      unassigned.push({ id: ride?.id ?? null, reason: "chauffeur manquant" });
      continue;
    }
    if (!byDriver.has(driverId)) byDriver.set(driverId, []);
    byDriver.get(driverId).push(ride);
  }
  return {
    statements: [...byDriver.entries()].map(([driverId, driverRides]) => ({
      driverId,
      ...prepareHourlyReconciliation(driverRides, period),
    })),
    unassigned,
    readyForPayment: false,
  };
}
