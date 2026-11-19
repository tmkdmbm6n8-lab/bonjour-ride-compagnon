// Pure rules for private clients and the favorite driver (unit-tested).
// The server validates identity and commits every transition atomically.

/** A QR code invitation shown by a driver is valid for five minutes. */
export const PRIVATE_INVITATION_SECONDS = 5 * 60;
/** After a scan, the new rider has 24 hours to sign up / confirm the e-mail and finish the link. */
export const PRIVATE_CLAIM_HOURS = 24;
/** Local storage key holding a scanned invitation until the rider is signed in. */
export const PENDING_CLAIM_KEY = "sd_private_claim";

/**
 * What the rider sees on the favorite card at the top of the ride comparator.
 * available: online, approved, free → can be chosen; busy: on another ride; offline: anything else.
 */
export function favoriteStatus({ driver, inPool, busy }) {
  if (!driver) return null;
  if (inPool) return "available";
  if (driver.is_online && driver.is_approved && busy) return "busy";
  return "offline";
}

/** Approach minutes shown to the rider, never invented: null when no reliable duration is known. */
export function favoriteEtaMinutes(approachSeconds) {
  if (!Number.isFinite(approachSeconds) || approachSeconds < 0) return null;
  return Math.max(1, Math.round(approachSeconds / 60));
}

/** A stored pending claim is usable only when well-formed and not expired. */
export function pendingClaimUsable(claim, now = Date.now()) {
  return Boolean(
    claim &&
      typeof claim.claimToken === "string" &&
      /^[A-Za-z0-9_-]{43}$/.test(claim.claimToken) &&
      Number.isFinite(claim.expiresAt) &&
      claim.expiresAt > now,
  );
}

export function privateOfferDecision({ favoriteId, driver, riderId, choice, existingPhase, now, deadline }) {
  if (!favoriteId || favoriteId === riderId || !driver || driver.user_id !== favoriteId) return { kind: "ordinary" };
  if (!driver.is_approved || !driver.is_online || driver.eligible === false) return { kind: "ordinary" };
  if (driver.busy && choice !== "wait") return { kind: "ordinary" };
  if (existingPhase === "private" && Number.isFinite(deadline) && now >= deadline) return { kind: "ordinary" };
  return { kind: driver.busy ? "queue" : "priority", driverId: favoriteId };
}

// A waiting estimate is only displayed when both legs are known. Values are seconds.
export function privateDriverWaitMinutes(remainingCurrentSeconds, approachSeconds) {
  if (
    !Number.isFinite(remainingCurrentSeconds) ||
    remainingCurrentSeconds < 0 ||
    !Number.isFinite(approachSeconds) ||
    approachSeconds < 0
  )
    return null;
  return Math.ceil((remainingCurrentSeconds + approachSeconds) / 60);
}

// The regular cancellation rules decide whether a fee applies.
export function favoriteCancellationIsFree() {
  return false;
}
