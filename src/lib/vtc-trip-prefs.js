import { haversineDistance } from "./utils/geo";

// Préférences de course choisies par le chauffeur (page « Préférences ») :
// accepter ou non les paiements en espèces, note minimale du passager, gain net minimum par km.
// Pures et testées : la répartition (vtc-dispatch.js) ne propose une course qu'aux chauffeurs dont les préférences l'acceptent.

export const MIN_RIDER_RATING_OPTIONS = [4.0, 4.3, 4.5, 4.7, 4.8];
export const MIN_PAY_PER_KM_OPTIONS = [1.25, 1.5, 1.75, 2.0, 2.5];
/** Un passager avec moins de notes que ce seuil n'est jamais filtré (nouveau passager). */
export const RIDER_RATING_MIN_COUNT = 3;
/** Facteur route/vol d'oiseau, identique au reste de l'app pour l'approche. */
const ROAD_FACTOR = 1.35;

export const DEFAULT_TRIP_PREFS = { acceptCash: true, minRiderRating: null, minPayPerKm: null };

export function sanitizeTripPrefs(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const rating = Number(p.minRiderRating);
  const perKm = Number(p.minPayPerKm);
  return {
    acceptCash: p.acceptCash !== false,
    minRiderRating: MIN_RIDER_RATING_OPTIONS.includes(rating) ? rating : null,
    minPayPerKm: MIN_PAY_PER_KM_OPTIONS.includes(perKm) ? perKm : null,
  };
}

export function tripPrefsOf(driver) {
  return sanitizeTripPrefs(driver?.trip_prefs ?? driver?.tripPrefs);
}

/** Vrai quand au moins un filtre réduit les courses proposées. */
export function isFiltering(prefs) {
  const p = sanitizeTripPrefs(prefs);
  return !p.acceptCash || p.minRiderRating != null || p.minPayPerKm != null;
}

/** Note moyenne du passager à partir des notes laissées par les chauffeurs, ou null s'il en a trop peu. */
export function riderAverage(ratings) {
  const list = (ratings || []).map(Number).filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  if (list.length < RIDER_RATING_MIN_COUNT) return null;
  return Math.round((list.reduce((s, n) => s + n, 0) / list.length) * 100) / 100;
}

/** Gain net du chauffeur par km roulé, approche comprise quand sa position est connue. */
export function payPerKm(ride, driver) {
  const earnings = Number(ride?.fare?.driverEarnings);
  const tripKm = (Number(ride?.route?.distanceMeters) || 0) / 1000;
  let approachKm = 0;
  if (driver?.location && ride?.pickup)
    approachKm =
      haversineDistance(driver.location.lat, driver.location.lng, ride.pickup.lat, ride.pickup.lng) * ROAD_FACTOR;
  const km = tripKm + approachKm;
  if (!Number.isFinite(earnings) || km <= 0) return null;
  return earnings / km;
}

/** Les préférences du chauffeur acceptent-elles cette course ? */
export function tripPrefsAllow(driver, ride) {
  const p = tripPrefsOf(driver);
  if (!p.acceptCash && ride?.payment?.method === "cash") return false;
  const rating = ride?.rider_rating == null ? null : Number(ride.rider_rating);
  if (p.minRiderRating != null && rating != null && rating < p.minRiderRating) return false;
  if (p.minPayPerKm != null) {
    const perKm = payPerKm(ride, driver);
    if (perKm != null && perKm + 1e-9 < p.minPayPerKm) return false;
  }
  return true;
}
