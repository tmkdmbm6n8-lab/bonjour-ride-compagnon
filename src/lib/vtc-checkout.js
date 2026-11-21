// Règles des paiements par carte (pures, testées) : recharge libre du portefeuille et course payée par carte.
export const TOPUP_MIN = 5;
export const TOPUP_MAX = 1000;
/** Une course payée par carte doit être confirmée dans ce délai, sinon le montant reste sur le portefeuille. */
export const CARD_BOOKING_TTL_MS = 30 * 60 * 1000;

/** Raison du refus d'une recharge, ou null. Montant libre entre 5 € et 1 000 €, au centime près. */
export function topupAmountProblem(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "Saisissez un montant valide";
  if (n < TOPUP_MIN || n > TOPUP_MAX) return `Le montant doit être compris entre ${TOPUP_MIN} € et ${TOPUP_MAX.toLocaleString("fr-FR")} €`;
  if (Math.round(n * 100) !== Math.round(n * 1000) / 10) return "Le montant ne peut pas dépasser deux décimales";
  return null;
}
export const toCents = (amount) => Math.round(Number(amount) * 100);
export const isStripeEnv = (v) => v === "sandbox" || v === "live";
export function cardBookingExpired(createdAt, now = Date.now()) {
  return now - new Date(createdAt).getTime() > CARD_BOOKING_TTL_MS;
}
/** Origine de retour après paiement : http(s)://hôte uniquement, sans chemin. */
export function safeOrigin(origin, trustedOrigin) {
  if (typeof origin !== "string" || !/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin)) return null;
  if (trustedOrigin === undefined) return origin; // Syntax-only check for existing callers.
  try {
    const trusted = new URL(trustedOrigin);
    if (!["https:", "http:"].includes(trusted.protocol) || trusted.origin !== origin) return null;
    if (trusted.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(trusted.hostname)) return null;
    return origin;
  } catch {
    return null;
  }
}
