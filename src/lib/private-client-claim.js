// Browser-side storage of a scanned invitation until the rider is signed in (claim token only, never the QR code).
import { PENDING_CLAIM_KEY, pendingClaimUsable } from "./private-client-policy";

export function readPendingClaim() {
  try {
    const claim = JSON.parse(window.localStorage.getItem(PENDING_CLAIM_KEY) || "null");
    if (pendingClaimUsable(claim)) return claim;
    window.localStorage.removeItem(PENDING_CLAIM_KEY);
  } catch {
    /* storage unavailable */
  }
  return null;
}

export function savePendingClaim(claim) {
  try {
    window.localStorage.setItem(PENDING_CLAIM_KEY, JSON.stringify(claim));
  } catch {
    /* storage unavailable */
  }
}

export function clearPendingClaim() {
  try {
    window.localStorage.removeItem(PENDING_CLAIM_KEY);
  } catch {
    /* storage unavailable */
  }
}
