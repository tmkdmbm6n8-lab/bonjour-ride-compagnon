// Temporary handoff within this open page. Nothing is written to browser storage.
let pendingRide = null;

function point(value) {
  if (!value || typeof value.address !== 'string' || !value.address.trim() ||
      !Number.isFinite(value.lat) || Math.abs(value.lat) > 90 ||
      !Number.isFinite(value.lng) || Math.abs(value.lng) > 180) return null;
  return { address: value.address.slice(0, 1000), lat: value.lat, lng: value.lng };
}

export function clearRideDraft() {
  pendingRide = null;
}

export function readRideDraft() {
    if (typeof window === 'undefined' || !pendingRide) return null;
    const draft = pendingRide;
    const pickupText = typeof draft.pickupText === 'string' ? draft.pickupText.slice(0, 1000) : '';
    const dropoffText = typeof draft.dropoffText === 'string' ? draft.dropoffText.slice(0, 1000) : '';
    const pickup = point(draft.pickup);
    const dropoff = point(draft.dropoff);
    return {
      pickup: pickup?.address === pickupText ? pickup : null,
      dropoff: dropoff?.address === dropoffText ? dropoff : null,
      pickupText, dropoffText,
    };
}

export function saveRideDraft({ pickup, dropoff, pickupText, dropoffText }) {
    if (typeof window === 'undefined') return;
    if (!pickupText && !dropoffText) { clearRideDraft(); return; }
    pendingRide = {
      pickup: point(pickup), dropoff: point(dropoff),
      pickupText: pickupText.slice(0, 1000), dropoffText: dropoffText.slice(0, 1000),
    };
}
