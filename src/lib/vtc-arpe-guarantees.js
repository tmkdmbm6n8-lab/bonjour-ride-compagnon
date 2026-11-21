// ARPE : garantie horaire vérifiée par chauffeur et par mois civil (ou 4 semaines).
// Ne jamais ajouter ce complément au prix annoncé au passager.
export const HOURLY_GUARANTEE_EUR = 30;
const centsUp = (n) => Math.ceil((n - 1e-9) * 100) / 100;
const cents = (n) => Math.round(n * 100) / 100;
const positive = (n) => Math.max(0, Number(n) || 0);

/**
 * Réservation immédiate : temps acceptation -> dépôt.
 * Réservation à l'avance : temps de course + min(15 % du temps de course, 5 minutes).
 * Les temps de course et d'approche doivent provenir d'horodatages réels.
 */
export function eligibleActivitySeconds({ rideSeconds, approachSeconds, advanceBooking = false }) {
  const ride = positive(rideSeconds);
  return ride + (advanceBooking ? Math.min(ride * 0.15, 300) : positive(approachSeconds));
}

/**
 * Prépare un état de rapprochement mensuel, sans effectuer de paiement.
 * Revenu : montant réellement perçu après commission + primes, hors pourboires.
 * L'appelant doit fournir exclusivement les courses terminées de la même période.
 */
export function hourlyGuaranteeStatement(rides) {
  const totals = (rides || []).reduce((acc, ride) => {
    acc.activitySeconds += eligibleActivitySeconds(ride);
    acc.rideSeconds += positive(ride.rideSeconds);
    acc.approachSeconds += positive(ride.approachSeconds);
    acc.earnings += positive(ride.driverEarnings) + positive(ride.bonuses);
    return acc;
  }, { activitySeconds: 0, rideSeconds: 0, approachSeconds: 0, earnings: 0 });
  const guaranteed = centsUp(totals.activitySeconds / 3600 * HOURLY_GUARANTEE_EUR);
  const earned = cents(totals.earnings);
  return { ...totals, earned, guaranteed, supplementDue: cents(Math.max(0, guaranteed - earned)) };
}
