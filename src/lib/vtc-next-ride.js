import { canServe } from "./vtc-classes";
import { tripPrefsAllow } from "./vtc-trip-prefs";

// Eligibility only. Atomic reservation/promotion requires the Lovable queue schema.
export const NEXT_RIDE_MAX_REMAINING_SECONDS = 3 * 60;
export const NEXT_RIDE_MAX_APPROACH_SECONDS = 5 * 60;
export const NEXT_RIDE_ROUTE_MAX_AGE_MS = 45 * 1000;

function freshTrafficRoute(route, now) {
  const at = Date.parse(route?.at || "");
  return (
    route?.source === "google" &&
    route.traffic === true &&
    !route.approximate &&
    Number.isFinite(route.durationSeconds) &&
    route.durationSeconds >= 0 &&
    Number.isFinite(at) &&
    at <= now &&
    now - at <= NEXT_RIDE_ROUTE_MAX_AGE_MS
  );
}

/** Existing live route must belong to this leg, not a cached pickup or another ride. */
export function canReceiveNextRide({
  driver,
  currentRide,
  liveRoute,
  hasQueuedRide,
  now = Date.now(),
}) {
  if (!driver?.user_id || !driver.is_online || !driver.is_approved || hasQueuedRide !== false)
    return false;
  if (
    !currentRide?.id ||
    currentRide.driver_id !== driver.user_id ||
    currentRide.status !== "in_progress" ||
    currentRide.is_test
  )
    return false;
  if (
    !freshTrafficRoute(liveRoute, now) ||
    liveRoute.status !== "in_progress" ||
    liveRoute.target !== "dropoff"
  )
    return false;
  return liveRoute.durationSeconds <= NEXT_RIDE_MAX_REMAINING_SECONDS;
}

/**
 * approachRoute is computed from CURRENT DROPOFF to NEXT PICKUP, never from driver GPS.
 * Both endpoint identities must be supplied by the server that performed the Google request.
 * Fail closed if traffic data is unavailable; no straight-line or fare-based approximation.
 */
export function nextRideEligibility({
  driver,
  currentRide,
  liveRoute,
  nextRide,
  approachRoute,
  hasQueuedRide,
  now = Date.now(),
}) {
  if (!canReceiveNextRide({ driver, currentRide, liveRoute, hasQueuedRide, now })) return null;
  if (
    !nextRide?.id ||
    nextRide.id === currentRide.id ||
    nextRide.status !== "searching" ||
    nextRide.driver_id ||
    nextRide.is_test
  )
    return null;
  if (
    (nextRide.declined || []).includes(driver.user_id) ||
    !canServe(driver, nextRide.vehicle_type) ||
    !tripPrefsAllow(driver, nextRide)
  )
    return null;
  if (
    !freshTrafficRoute(approachRoute, now) ||
    approachRoute.fromRideId !== currentRide.id ||
    approachRoute.toRideId !== nextRide.id
  )
    return null;
  if (
    !samePoint(approachRoute.origin, currentRide.dropoff) ||
    !samePoint(approachRoute.destination, nextRide.pickup)
  )
    return null;
  if (approachRoute.durationSeconds > NEXT_RIDE_MAX_APPROACH_SECONDS) return null;
  return {
    currentRideId: currentRide.id,
    nextRideId: nextRide.id,
    remainingSeconds: liveRoute.durationSeconds,
    approachAfterDropoffSeconds: approachRoute.durationSeconds,
    estimatedPickupWaitSeconds: liveRoute.durationSeconds + approachRoute.durationSeconds,
  };
}

function samePoint(a, b) {
  return Number.isFinite(a?.lat) && Number.isFinite(a?.lng) && a.lat === b?.lat && a.lng === b?.lng;
}
