import { haversineDistance } from "./utils/geo";

// Gammes de véhicules et courses de gamme inférieure qu'un chauffeur peut accepter.
// Go ne peut rien accepter d'autre ; Comfort peut accepter Go ; Lux peut accepter Comfort et/ou Go ;
// XL peut accepter Go et/ou Comfort. Lux et XL restent séparés, et personne ne roule dans une gamme supérieure.
export const VEHICLE_CLASSES = ["economy", "comfort", "pet", "xl"];

export const LOWER_CLASSES = {
  economy: ["pet"],
  comfort: ["economy", "pet"],
  pet: ["economy"],
  xl: ["economy", "comfort", "pet"],
  premium: ["comfort", "economy", "pet"], // conservation rétro-compatibilité
};
export function isVehicleClass(value) {
  return VEHICLE_CLASSES.includes(value);
}

/** Classe attribuée au chauffeur (par l'admin). */
export function driverClass(driver) {
  const c = driver?.vehicle_class ?? driver?.vehicleClass ?? driver?.vehicle?.type;
  return isVehicleClass(c) ? c : "economy";
}

/** Garde seulement les gammes inférieures autorisées pour cette classe, sans doublon. */
export function sanitizeAcceptedClasses(ownClass, accepted) {
  const allowed = LOWER_CLASSES[ownClass] || [];
  const list = Array.isArray(accepted) ? accepted : [];
  return allowed.filter((c) => list.includes(c));
}

/** Toutes les gammes dont le chauffeur reçoit les courses : la sienne + celles qu'il a cochées. */
export function servedClasses(driver) {
  const own = driverClass(driver);
  return [own, ...sanitizeAcceptedClasses(own, driver?.accepts_classes ?? driver?.acceptsClasses)];
}

export function canServe(driver, rideClass) {
  return servedClasses(driver).includes(rideClass);
}

/** True when the driver gets this ride only because he opted into a lower class. */
export function isLowerClassRide(driver, rideClass) {
  return driverClass(driver) !== rideClass && canServe(driver, rideClass);
}

/**
 * Disponibilité affichée au passager, par gamme : nombre de chauffeurs libres qui peuvent
 * faire la course (leur gamme ou une gamme inférieure acceptée) et délai du plus proche.
 */
export function availabilityByClass(drivers, pickup, speedKmh = 25) {
  const out = Object.fromEntries(VEHICLE_CLASSES.map((c) => [c, { count: 0, etaMinutes: null }]));
  for (const d of drivers || []) {
    const km =
      d?.location && pickup ? haversineDistance(d.location.lat, d.location.lng, pickup.lat, pickup.lng) * 1.35 : null;
    const eta = km == null ? null : Math.max(1, Math.round((km / speedKmh) * 60));
    for (const c of servedClasses(d)) {
      out[c].count += 1;
      if (eta != null && (out[c].etaMinutes == null || eta < out[c].etaMinutes)) out[c].etaMinutes = eta;
    }
  }
  return out;
}
