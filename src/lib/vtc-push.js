// Pure rules for ride-offer push notifications (unit-tested in src/test/vtc-push.test.ts).
import { canSeeOffer } from "./vtc-dispatch";
import { formatEuro } from "./vtc-pricing";

/** Android channel shown as a heads-up banner with sound; created by the app on first launch. */
export const OFFER_CHANNEL_ID = "ride_offers";
export const OFFER_PATH = "/driver/dashboard";
export const APPLE_BUNDLE_ID = "fr.strasdrive.app";
export const isApnsHexToken = (token) => /^[0-9a-f]{64,200}$/i.test(String(token || "").trim());

/** Drivers who can see the ride after a dispatch step but could not before: each gets exactly one push per step. */
export function newlyOfferedDriverIds(before, after, pool, now = Date.now()) {
  if (!after || !Array.isArray(pool)) return [];
  return pool
    .filter((d) => canSeeOffer(after, d, now, pool) && !(before && canSeeOffer(before, d, now, pool)))
    .map((d) => d.user_id);
}

/** Seconds the offer stays open; the push is dropped instead of arriving after it expired. */
export function offerSecondsLeft(ride, now = Date.now()) {
  const until = ride?.offer_expires_at ? new Date(ride.offer_expires_at).getTime() : 0;
  return Math.max(0, Math.ceil((until - now) / 1000));
}

function cleanAddress(addr) {
  if (!addr) return "";
  return String(addr).trim();
}

function formatKm(meters) {
  if (!meters || meters <= 0) return null;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

function formatMin(seconds) {
  if (!seconds || seconds <= 0) return null;
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

/** FCM HTTP v1 message body (without the target) for a ride offer. Never reveals the dispatch phase. */
export function buildOfferMessage(ride, now = Date.now()) {
  const amount = Number(ride?.fare?.driverEarnings);
  const title = Number.isFinite(amount) ? `Nouvelle course · ${formatEuro(amount)}` : "Nouvelle course";

  // 2. Départ : adresse + distance / temps d'approche du chauffeur
  const pickup = cleanAddress(ride?.pickup?.address || ride?.pickup_address);
  let pickupMetrics = null;
  if (ride?.approach_km != null && ride?.approach_min != null) {
    pickupMetrics = `${Number(ride.approach_km).toFixed(1).replace(".", ",")} km (${ride.approach_min} min)`;
  } else if (ride?.approach_meters != null) {
    const km = (ride.approach_meters / 1000).toFixed(1).replace(".", ",");
    const min = Math.max(1, Math.round((ride.approach_seconds || (ride.approach_meters / 1000 / 25) * 3600) / 60));
    pickupMetrics = `${km} km (${min} min)`;
  }

  // 3. Arrivée : adresse + distance et durée de la course
  const dropoff = cleanAddress(ride?.dropoff?.address || ride?.dropoff_address);
  const tripKm = formatKm(Number(ride?.route?.distanceMeters || ride?.route?.distance || 0));
  const tripMin = formatMin(Number(ride?.route?.durationSeconds || ride?.route?.duration || 0));
  const tripMetrics = [tripKm, tripMin ? `(${tripMin})` : null].filter(Boolean).join(" ");

  const lines = [];
  if (pickup) {
    lines.push(pickupMetrics ? `📍 Départ : ${pickup} · ${pickupMetrics}` : `📍 Départ : ${pickup}`);
  }
  if (dropoff) {
    lines.push(tripMetrics ? `🏁 Arrivée : ${dropoff} · ${tripMetrics}` : `🏁 Arrivée : ${dropoff}`);
  }
  const body = lines.length > 0 ? lines.join("\n") : "Ouvrez StrasDrive pour voir la course";

  const ttl = Math.max(1, offerSecondsLeft(ride, now));

  return {
    notification: {
      title,
      body,
    },
    data: {
      type: "ride_offer",
      rideId: String(ride?.id || ""),
      path: ride?.id ? `${OFFER_PATH}?offer=${encodeURIComponent(ride.id)}` : OFFER_PATH,
    },
    apns: {
      headers: {
        "apns-priority": "10",
        "apns-push-type": "alert",
        "apns-topic": APPLE_BUNDLE_ID,
        "apns-expiration": String(Math.floor(now / 1000) + ttl),
      },
      payload: {
        aps: {
          alert: {
            title,
            body,
          },
          sound: "default",
          "interruption-level": "time-sensitive",
          category: "RIDE_OFFER",
        },
      },
    },
    android: {
      priority: "high",
      ttl: `${ttl}s`,
      collapse_key: "ride_offer",
      notification: {
        channel_id: OFFER_CHANNEL_ID,
        icon: "ic_stat_strasdrive",
        tag: `ride_${ride?.id || "offer"}`,
        default_sound: true,
        default_vibrate_timings: true,
        notification_priority: "PRIORITY_MAX",
        visibility: "PUBLIC",
        color: "#C9A227",
      },
    },
  };
}

/** A device token the provider reports as dead must be deleted, never retried. */
export function isStaleTokenError(status, bodyText = "") {
  if (/not a valid FCM registration token/i.test(bodyText)) return false;
  return (
    status === 404 ||
    (status === 400 && /INVALID_ARGUMENT|registration token/i.test(bodyText)) ||
    /UNREGISTERED/.test(bodyText)
  );
}

export function validPushToken(token) {
  const t = String(token || "");
  return t.length >= 20 && t.length <= 4096 && !/\s/.test(t) ? t : null;
}

export function buildDirectApnsPayload(ride, now = Date.now()) {
  const message = buildOfferMessage(ride, now);
  return { ...message.apns.payload, ...message.data };
}
