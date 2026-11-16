// Pure rules for ride-offer push notifications (unit-tested in src/test/vtc-push.test.ts).
import { canSeeOffer } from "./vtc-dispatch";
import { formatEuro } from "./vtc-pricing";

/** Android channel shown as a heads-up banner with sound; created by the app on first launch. */
export const OFFER_CHANNEL_ID = "ride_offers";
export const OFFER_PATH = "/driver/dashboard";

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

/** FCM HTTP v1 message body (without the target) for a ride offer. Never reveals the dispatch phase. */
export function buildOfferMessage(ride, now = Date.now()) {
  const amount = Number(ride?.fare?.driverEarnings);
  const title = Number.isFinite(amount) ? `Nouvelle course · ${formatEuro(amount)}` : "Nouvelle course";
  const pickup = String(ride?.pickup?.address || "").split(",")[0].trim();
  const body = pickup ? `Prise en charge : ${pickup}` : "Ouvrez StrasDrive pour voir la course";
  const ttl = Math.max(1, offerSecondsLeft(ride, now));
  return {
    notification: { title, body },
    data: { type: "ride_offer", rideId: String(ride?.id || ""), path: OFFER_PATH },
    android: {
      priority: "high",
      ttl: `${ttl}s`,
      collapse_key: "ride_offer",
      notification: {
        channel_id: OFFER_CHANNEL_ID,
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
  return status === 404 || (status === 400 && /INVALID_ARGUMENT|registration token/i.test(bodyText)) || /UNREGISTERED/.test(bodyText);
}

export function validPushToken(token) {
  const t = String(token || "");
  return t.length >= 20 && t.length <= 4096 && !/\s/.test(t) ? t : null;
}
