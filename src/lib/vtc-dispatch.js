import {haversineDistance} from './utils/geo';

// Ride dispatch, in three steps:
// 1. "priority": every available priority driver sees the ride at once, whatever the distance; first to accept wins.
// 2. "nearest": the closest other driver sees it alone for a short head start.
// 3. "broadcast": every available driver sees it; first to accept wins. When this window ends, the ride has no driver.
export const PRIORITY_WINDOW_SECONDS = 15;
export const NEAREST_WINDOW_SECONDS = 10;
export const BROADCAST_WINDOW_SECONDS = 60;

const iso = (ms) => new Date(ms).toISOString();

export function distanceToPickupKm(ride, driver) {
  if (!driver?.location || !ride?.pickup) return Infinity;
  return haversineDistance(driver.location.lat, driver.location.lng, ride.pickup.lat, ride.pickup.lng);
}

/** Drivers (already online, approved and free) who can still receive this ride. */
export function availableFor(ride, drivers) {
  const declined = ride.declined || [];
  return drivers.filter((d) => d.vehicle?.type === ride.vehicle_type && !declined.includes(d.user_id));
}

/** Returns the update to apply to a searching ride, or null when its current step is still running. */
export function planDispatch(ride, drivers, now = Date.now()) {
  if (ride.status !== 'searching') return null;
  const pool = availableFor(ride, drivers);
  const until = ride.offer_expires_at ? new Date(ride.offer_expires_at).getTime() : 0;
  const running = now < until;
  const phase = ride.dispatch_phase || null;

  if (phase === 'priority' && running && pool.some((d) => d.is_priority)) return null;
  if (phase === 'nearest' && running && pool.some((d) => d.user_id === ride.offer_driver_id)) return null;
  if (phase === 'broadcast') {
    return running ? null : { status: 'no_drivers', dispatch_phase: null, offer_driver_id: null, offer_expires_at: null };
  }

  if (!phase && pool.some((d) => d.is_priority)) {
    return { dispatch_phase: 'priority', offer_driver_id: null, offer_expires_at: iso(now + PRIORITY_WINDOW_SECONDS * 1000) };
  }
  if (phase !== 'nearest') {
    const nearest = pool
      .filter((d) => !d.is_priority && d.location)
      .sort((a, b) => distanceToPickupKm(ride, a) - distanceToPickupKm(ride, b))[0];
    if (nearest) {
      return { dispatch_phase: 'nearest', offer_driver_id: nearest.user_id, offer_expires_at: iso(now + NEAREST_WINDOW_SECONDS * 1000) };
    }
  }
  return { dispatch_phase: 'broadcast', offer_driver_id: null, offer_expires_at: iso(now + BROADCAST_WINDOW_SECONDS * 1000) };
}

/** Whether this driver (online, approved, free) may see and accept the ride right now. */
export function canSeeOffer(ride, driver, now = Date.now()) {
  if (!driver || ride.status !== 'searching' || !ride.dispatch_phase) return false;
  if (!ride.offer_expires_at || new Date(ride.offer_expires_at).getTime() <= now) return false;
  if (availableFor(ride, [driver]).length === 0) return false;
  if (ride.dispatch_phase === 'priority') return Boolean(driver.is_priority);
  if (ride.dispatch_phase === 'nearest') return ride.offer_driver_id === driver.user_id;
  return ride.dispatch_phase === 'broadcast';
}
