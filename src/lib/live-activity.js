// A minimal, privacy-conscious contract for the future iOS ActivityKit bridge.
// No names, phone numbers, addresses, PINs or chat content leave the app here.
const minutes = (seconds) => Number.isFinite(seconds) && seconds >= 0 ? Math.max(1, Math.ceil(seconds / 60)) : null;

export function driverOfferActivity(offer) {
  if (!offer || typeof offer.rideId !== 'string' || !offer.rideId) return null;
  if (!Number.isFinite(offer.receivedAt) || !Number.isFinite(offer.expiresInSeconds) || offer.expiresInSeconds <= 0) return null;
  const expiresAt = offer.expiresAt ? Date.parse(offer.expiresAt) : offer.receivedAt + offer.expiresInSeconds * 1000;
  if (!Number.isFinite(expiresAt)) return null;
  return {
    kind: 'driver_offer',
    reference: offer.rideId,
    pickupMinutes: Number.isFinite(offer.etaMinutes) && offer.etaMinutes >= 0 ? Math.ceil(offer.etaMinutes) : null,
    tripMinutes: minutes(offer.durationSeconds),
    amountCents: Number.isFinite(offer.earnings) && offer.earnings >= 0 ? Math.round(offer.earnings * 100) : null,
    expiresAt,
  };
}

export function riderTripActivity(ride, route) {
  if (!ride || typeof ride.id !== 'string' || !ride.id) return null;
  if (!['accepted', 'arrived', 'in_progress'].includes(ride.status)) return null;
  return {
    kind: 'rider_trip',
    reference: ride.id,
    phase: ride.status,
    remainingMinutes: route?.status === ride.status ? minutes(route.durationSeconds) : null,
  };
}
