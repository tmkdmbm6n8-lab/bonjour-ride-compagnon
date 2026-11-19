import { haversineDistance } from "./utils/geo";
import { canServe } from "./vtc-classes";
import { tripPrefsAllow } from "./vtc-trip-prefs";

// Ride dispatch, in three steps:
// 1. "priority": every available priority driver sees the ride at once, whatever the distance; first to accept wins.
// 2. "nearest": the closest other driver sees it alone for a short head start.
// 3. "broadcast": every available driver sees it; first to accept wins. When this window ends, the ride has no driver.
export const PRIORITY_WINDOW_SECONDS = 15;
export const NEAREST_WINDOW_SECONDS = 10;
export const BROADCAST_WINDOW_SECONDS = 4;
export const TEST_OFFER_SECONDS = BROADCAST_WINDOW_SECONDS;
// 0. "private": when the rider explicitly chose her favorite driver, only he sees the ride for this long.
//    If he declines, lets it expire, goes offline or cannot serve it, the ordinary dispatch starts (he stays in it).
export const PRIVATE_OFFER_SECONDS = 30;

const iso = (ms) => new Date(ms).toISOString();

export function distanceToPickupKm(ride, driver) {
  if (!driver?.location || !ride?.pickup) return Infinity;
  return haversineDistance(driver.location.lat, driver.location.lng, ride.pickup.lat, ride.pickup.lng);
}

// Fair share: a non-priority driver who already earned more than 30 % above the average of the
// other available non-priority drivers today stops receiving rides while others can take them.
// Small amounts are never throttled. Priority drivers are never throttled.
export const FAIR_SHARE_RATIO = 1.3;
export const FAIR_SHARE_MIN_EUR = 20;

export function isThrottled(driver, pool) {
  if (!driver || driver.is_priority) return false;
  const mine = Number(driver.earned_today) || 0;
  if (mine < FAIR_SHARE_MIN_EUR) return false;
  const others = pool.filter((d) => !d.is_priority && d.user_id !== driver.user_id);
  if (!others.length) return false;
  const avg = others.reduce((s, d) => s + (Number(d.earned_today) || 0), 0) / others.length;
  return mine > avg * FAIR_SHARE_RATIO;
}

/** Drivers (already online, approved and free) who can still receive this ride: its class, or a higher class that opted into it, minus drivers whose trip preferences (cash, rider rating, pay per km) refuse it and fair-share throttled drivers when someone else can take it. */
export function availableFor(ride, drivers) {
  const declined = ride.declined || [];
  const pool = drivers.filter(
    (d) => d.user_id !== ride.rider_id && canServe(d, ride.vehicle_type) && !declined.includes(d.user_id) && tripPrefsAllow(d, ride),
  );
  const fair = pool.filter((d) => !isThrottled(d, pool));
  return fair.length ? fair : pool;
}

/** Whether the favorite driver (online, approved, free) can take this ride himself: class, not declined, trip preferences. Fair share never applies to a ride the rider addressed to him. */
export function favoriteCanTake(ride, driver) {
  return Boolean(
    driver &&
      driver.user_id !== ride.rider_id &&
      canServe(driver, ride.vehicle_type) &&
      !(ride.declined || []).includes(driver.user_id) &&
      tripPrefsAllow(driver, ride),
  );
}

/** Returns the update to apply to a searching ride, or null when its current step is still running. */
export function planDispatch(ride, drivers, now = Date.now()) {
  if (ride.status !== "searching") return null;
  const pool = availableFor(ride, drivers);
  const until = ride.offer_expires_at ? new Date(ride.offer_expires_at).getTime() : 0;
  const running = now < until;
  const phase = ride.dispatch_phase || null;

  if (phase === "private") {
    const target = drivers.find((d) => d.user_id === ride.offer_driver_id);
    if (running && favoriteCanTake(ride, target)) return null;
    // Ordinary dispatch from the start; the favorite competes like any other driver.
    return planDispatch(
      { ...ride, dispatch_phase: null, offer_driver_id: null, offer_expires_at: null, favorite_driver_id: null },
      drivers,
      now,
    );
  }
  if (!phase && ride.favorite_driver_id) {
    const favorite = drivers.find((d) => d.user_id === ride.favorite_driver_id);
    if (favoriteCanTake(ride, favorite)) {
      return {
        dispatch_phase: "private",
        offer_driver_id: favorite.user_id,
        offer_expires_at: iso(now + PRIVATE_OFFER_SECONDS * 1000),
      };
    }
  }
  if (phase === "priority" && running && pool.some((d) => d.is_priority)) return null;
  if (phase === "nearest" && running && pool.some((d) => d.user_id === ride.offer_driver_id)) return null;
  if (phase === "broadcast") {
    return running
      ? null
      : { status: "no_drivers", dispatch_phase: null, offer_driver_id: null, offer_expires_at: null };
  }

  if (!phase && pool.some((d) => d.is_priority)) {
    return {
      dispatch_phase: "priority",
      offer_driver_id: null,
      offer_expires_at: iso(now + PRIORITY_WINDOW_SECONDS * 1000),
    };
  }
  if (phase !== "nearest") {
    const nearest = pool
      .filter((d) => !d.is_priority && d.location)
      .sort((a, b) => distanceToPickupKm(ride, a) - distanceToPickupKm(ride, b))[0];
    if (nearest) {
      return {
        dispatch_phase: "nearest",
        offer_driver_id: nearest.user_id,
        offer_expires_at: iso(now + NEAREST_WINDOW_SECONDS * 1000),
      };
    }
  }
  return {
    dispatch_phase: "broadcast",
    offer_driver_id: null,
    offer_expires_at: iso(now + BROADCAST_WINDOW_SECONDS * 1000),
  };
}
/** Whether this driver (online, approved, free) may see and accept the ride right now. */
/** Vérifie si un chauffeur est dans la zone proche (≤ 3 km ou ≤ 5 minutes d'approche) */
export function isDriverInCloseZone(ride, driver) {
  const km = distanceToPickupKm(ride, driver);
  if (!Number.isFinite(km)) return false;
  const meters = Math.round(km * 1350);
  const seconds = approachSecondsFor(meters);
  return km <= 3.0 || seconds <= 300;
}

/** Whether this driver (online, approved, free) may see and accept the ride right now. */
/** @param {any} ride @param {any} driver @param {number} [now] @param {any[] | null} [pool] */
export function canSeeOffer(ride, driver, now = Date.now(), pool = null) {
  if (!driver || ride.status !== "searching" || !ride.dispatch_phase) return false;
  if (!ride.offer_expires_at || new Date(ride.offer_expires_at).getTime() <= now) return false;
  if (ride.dispatch_phase === "private") return ride.offer_driver_id === driver.user_id && favoriteCanTake(ride, driver);
  const all = pool && pool.some((d) => d.user_id === driver.user_id) ? pool : [driver];
  if (!availableFor(ride, all).some((d) => d.user_id === driver.user_id)) return false;

  // Phase prioritaires (chauffeurs VIP)
  if (ride.dispatch_phase === "priority") return Boolean(driver.is_priority);

  // Phase zone proche (10 secondes) : seuls les chauffeurs à ≤ 3 km ou ≤ 5 min la reçoivent
  if (ride.dispatch_phase === "nearest") {
    const candidates = pool || [driver];
    const hasCloseDrivers = candidates.some((d) => isDriverInCloseZone(ride, d));
    if (hasCloseDrivers) {
      return isDriverInCloseZone(ride, driver);
    }
    // Si aucun chauffeur n'est dans les 3 km / 5 min, seul le plus proche de la ville la reçoit
    return ride.offer_driver_id === driver.user_id;
  }

  // Phase générale ("broadcast") : tous les chauffeurs disponibles la reçoivent normalement
  return true;
}

// Profitability shown to priority drivers: expected net gain per hour, counting the drive to the passenger.
export const VERY_PROFITABLE_PER_HOUR = 45;
export const PROFITABLE_PER_HOUR = 30;
export const APPROACH_SPEED_KMH = 25;

export function approachSecondsFor(meters) {
  return Math.max(60, ((Number(meters) || 0) / 1000 / APPROACH_SPEED_KMH) * 3600);
}

export function profitability(netEarnings, approachSeconds, tripSeconds) {
  const hours = Math.max(1, (Number(approachSeconds) || 0) + (Number(tripSeconds) || 0)) / 3600;
  const perHour = Math.round(((Number(netEarnings) || 0) / hours) * 100) / 100;
  const level =
    perHour >= VERY_PROFITABLE_PER_HOUR
      ? "very_profitable"
      : perHour >= PROFITABLE_PER_HOUR
        ? "profitable"
        : "not_profitable";
  return { perHour, level };
}
// Zone de prise en charge : le chauffeur doit être à moins de PICKUP_ZONE_METERS
// du point de prise en charge pour signaler son arrivée et démarrer la course.
export const PICKUP_ZONE_METERS = 150;
export const ARRIVAL_ZONE_METERS = 20;

/** Renvoie null si le chauffeur est dans la zone, sinon le message à afficher. */
export function pickupZoneProblem(driverLocation, pickup, radius = PICKUP_ZONE_METERS) {
  if (!driverLocation || !Number.isFinite(driverLocation.lat) || !Number.isFinite(driverLocation.lng)) {
    return "Position GPS introuvable — activez la localisation";
  }
  if (!pickup || !Number.isFinite(pickup.lat) || !Number.isFinite(pickup.lng)) return "Position du point de prise en charge indisponible";
  const meters = haversineDistance(driverLocation.lat, driverLocation.lng, pickup.lat, pickup.lng) * 1000;
  if (meters <= radius) return null;
  return `Rapprochez-vous du point de prise en charge (encore ${Math.ceil(meters - radius)} m)`;
}
