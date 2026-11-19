// Pure decisions only. The server must validate identity and commit transitions atomically.
export function privateOfferDecision({ favoriteId, driver, riderId, choice, existingPhase, now, deadline }) {
  if (!favoriteId || favoriteId === riderId || !driver || driver.user_id !== favoriteId) return { kind: 'ordinary' };
  if (!driver.is_approved || !driver.is_online || driver.eligible === false) return { kind: 'ordinary' };
  if (driver.busy && choice !== 'wait') return { kind: 'ordinary' };
  if (existingPhase === 'private' && Number.isFinite(deadline) && now >= deadline) return { kind: 'ordinary' };
  return { kind: driver.busy ? 'queue' : 'priority', driverId: favoriteId };
}

// A waiting estimate is only displayed when both legs are known. Values are seconds.
export function privateDriverWaitMinutes(remainingCurrentSeconds, approachSeconds) {
  if (!Number.isFinite(remainingCurrentSeconds) || remainingCurrentSeconds < 0 ||
      !Number.isFinite(approachSeconds) || approachSeconds < 0) return null;
  return Math.ceil((remainingCurrentSeconds + approachSeconds) / 60);
}

// The server must load the ride and identities itself; never trust browser-provided fields.
export function favoriteCancellationIsFree(ride, riderId) {
  return Boolean(
    ride && riderId && ride.rider_id === riderId &&
    ['accepted', 'arrived'].includes(ride.status) &&
    ride.favorite_driver_id && ride.driver_id === ride.favorite_driver_id,
  );
}
