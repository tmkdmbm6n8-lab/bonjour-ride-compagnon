let pendingRide = null;

function point(value) {
  if (!value || typeof value.address !== 'string' || !value.address.trim() ||
      !Number.isFinite(value.lat) || Math.abs(value.lat) > 90 ||
      !Number.isFinite(value.lng) || Math.abs(value.lng) > 180) return null;
  return { address: value.address.slice(0, 1000), lat: value.lat, lng: value.lng };
}

export function clearRideDraft() {
  pendingRide = null;
  if (typeof window !== 'undefined') {
    try { sessionStorage.removeItem("strasdrive_ride_draft"); } catch {}
  }
}

export function readRideDraft() {
  if (typeof window === 'undefined') return null;
  let draft = pendingRide;
  if (!draft) {
    try {
      const stored = sessionStorage.getItem("strasdrive_ride_draft");
      if (stored) draft = JSON.parse(stored);
    } catch {}
  }
  if (!draft) return null;
  const pickupText = typeof draft.pickupText === 'string' ? draft.pickupText.slice(0, 1000) : '';
  const dropoffText = typeof draft.dropoffText === 'string' ? draft.dropoffText.slice(0, 1000) : '';
  const pickup = point(draft.pickup);
  const dropoff = point(draft.dropoff);
  return {
    pickup: pickup?.address === pickupText ? pickup : pickup || null,
    dropoff: dropoff?.address === dropoffText ? dropoff : dropoff || null,
    pickupText,
    dropoffText,
    scheduledAt: draft.scheduledAt || null,
    transportType: draft.transportType || null,
    transportNumber: draft.transportNumber || null,
  };
}

export function saveRideDraft({ pickup, dropoff, pickupText, dropoffText, scheduledAt, transportType, transportNumber }) {
  if (typeof window === 'undefined') return;
  if (!pickupText && !dropoffText) { clearRideDraft(); return; }
  pendingRide = {
    pickup: point(pickup),
    dropoff: point(dropoff),
    pickupText: pickupText ? pickupText.slice(0, 1000) : '',
    dropoffText: dropoffText ? dropoffText.slice(0, 1000) : '',
    scheduledAt: scheduledAt || null,
    transportType: transportType || null,
    transportNumber: transportNumber || null,
  };
  try {
    sessionStorage.setItem("strasdrive_ride_draft", JSON.stringify(pendingRide));
  } catch {}
}
