// Contrat APNs du widget GenericAttributes de capacitor-live-activity.
// Destinataires déjà autorisés par le dispatch ; aucun nouvel accès aux courses.
export const LIVE_ACTIVITY_TEST_DRIVER_ID = "a0c1029a-73e0-448a-8451-a2e997f608fc";
export const LIVE_ACTIVITY_ATTRIBUTES_TYPE = "GenericAttributes";

export function liveActivityOfferDriverIds(ride, userIds) {
  if (!ride?.id) return [];
  return [...new Set((userIds || []).filter((id) => typeof id === 'string' && id.length > 0))];
}

/** Match a classic APNs token to its Live Activity device without storing another secret. */
export async function pushDeviceId(token) {
  const value = String(token || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64,200}$/.test(value)) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function validLiveActivityToken(token) {
  const value = String(token || "").trim();
  return /^(?:[0-9a-f]{2}){16,256}$/i.test(value) ? value : null;
}

export function validLiveActivityDeviceId(value) {
  const id = String(value || "").trim();
  return /^[a-z0-9_-]{16,80}$/i.test(id) ? id : null;
}

export function validLiveActivityReference(value) {
  const id = String(value || "").trim();
  return /^[a-z0-9_-]{1,128}$/i.test(id) ? id : null;
}

/** Toutes les valeurs sont des chaînes : c'est le dictionnaire Swift [String: String]. */
export function buildLiveActivityStart(ride, now = Date.now()) {
  const timestamp = Math.floor(now / 1000);
  const expiresAt = Math.floor(Date.parse(ride?.offer_expires_at || "") / 1000);
  if (!ride?.id || !Number.isFinite(expiresAt) || expiresAt <= timestamp) return null;
  const earnings = Number(ride?.fare?.driverEarnings);
  const values = {
    title: "Course",
    status: "Nouvelle course",
    message: "Nouvelle course disponible",
    type: "driver_offer",
    expiresAt: String(expiresAt),
  };
  if (Number.isFinite(earnings)) {
    values.earnings = `${earnings.toFixed(2).replace(".", ",")} €`;
    values.title = values.earnings;
  }
  return {
    expiresAt,
    collapseId: `ride-${ride.id}`,
    payload: {
      aps: {
        timestamp,
        event: "start",
        "input-push-token": 1,
        "attributes-type": LIVE_ACTIVITY_ATTRIBUTES_TYPE,
        attributes: { id: String(ride.id), staticValues: { type: "driver_offer" } },
        "content-state": { values },
        "stale-date": expiresAt,
        alert: { title: `Nouvelle course · ${values.title}`, body: "Ouvrez StrasDrive pour voir la course", sound: "default" },
      },
    },
  };
}

export function buildLiveActivityEnd(now = Date.now()) {
  const timestamp = Math.floor(now / 1000);
  return {
    expiresAt: timestamp + 300,
    payload: {
      aps: {
        timestamp,
        event: "end",
        "content-state": { values: { title: "Course", status: "Offre terminée", message: "Offre terminée" } },
        "dismissal-date": timestamp,
      },
    },
  };
}

export function shouldCloseLiveActivityOffer(ride, userId, now = Date.now()) {
  if (!ride || ride.status !== "searching") return true;
  if (Array.isArray(ride.declined) && ride.declined.includes(userId)) return true;
  const deadline = Date.parse(ride.offer_expires_at || "");
  return !Number.isFinite(deadline) || deadline <= now;
}
