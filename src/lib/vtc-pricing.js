export const DEFAULT_PRICING = {
  economy: {
    baseFare: 2,
    perKmRate: 1,
    perMinRate: 0.15,
    minimumFare: 4,
    bookingFee: 0.5,
    platformCommission: 10,
    surgeMultiplierCap: 3,
  },
  comfort: {
    baseFare: 3,
    perKmRate: 1.5,
    perMinRate: 0.25,
    minimumFare: 6.5,
    bookingFee: 0.75,
    platformCommission: 10,
    surgeMultiplierCap: 3,
  },
  pet: {
    baseFare: 3.5,
    perKmRate: 1.35,
    perMinRate: 0.2,
    minimumFare: 7,
    bookingFee: 0.75,
    platformCommission: 10,
    surgeMultiplierCap: 3,
  },
  xl: {
    baseFare: 4,
    perKmRate: 1.8,
    perMinRate: 0.3,
    minimumFare: 8,
    bookingFee: 0.75,
    platformCommission: 10,
    surgeMultiplierCap: 3,
  },
};
// Taux de remise appliqué au tarif calculé (0.20 = 20 %). Mettre à 0 pour retirer la remise.
export const DISCOUNT_RATE = 0;

// Rémunération minimale des chauffeurs (accord ARPE VTC), montants nets de commission.
export const DRIVER_MIN_NET_PER_RIDE = 9; // € nets par course, quelle que soit la distance ou la durée
export const DRIVER_MIN_NET_PER_HOUR = 30; // € nets par heure d'activité, temps d'approche compris
export const DRIVER_MIN_NET_PER_KM = 1; // € nets par kilomètre parcouru
// Temps d'approche estimé, inclus dans le devis passager. Le temps réel est vérifié à la fin de la course.
export const ESTIMATED_APPROACH_SECONDS = 300;

const round2 = (n) => Math.round(n * 100) / 100;
const ceil2 = (n) => Math.ceil(Math.round(n * 1e6) / 1e4) / 100;
const feeFor = (total, commission) => Math.round(total * commission) / 100;

/** Planchers applicables au devis : 9 € par course et 1 €/km estimé. La garantie horaire est contrôlée par période. */
export function driverMinimumNet(meters, activitySeconds) {
  const km = Math.max(0, Number(meters) || 0) / 1000;
  // activitySeconds est conservé pour compatibilité, mais ne majore pas le devis.
  return ceil2(Math.max(DRIVER_MIN_NET_PER_RIDE, km * DRIVER_MIN_NET_PER_KM));
}

/** Prix passager minimum pour que le chauffeur touche `net` après la commission (en %). */
export function minimumPassengerTotal(net, commission) {
  const c = Math.min(99, Math.max(0, Number(commission) || 0));
  let total = ceil2(net / (1 - c / 100));
  while (round2(total - feeFor(total, c)) < net) total = round2(total + 0.01);
  return total;
}

export function calculateFare(
  rule,
  meters,
  seconds,
  surge = 1,
  discountRate = DISCOUNT_RATE,
  approachSeconds = ESTIMATED_APPROACH_SECONDS,
) {
  const distanceFare = (meters / 1000) * rule.perKmRate,
    timeFare = (seconds / 60) * rule.perMinRate;
  const subtotal = rule.baseFare + distanceFare + timeFare;
  const multiplier = Math.min(rule.surgeMultiplierCap, Math.max(1, surge));
  const originalTotal = round2(Math.max(subtotal * multiplier, rule.minimumFare) + rule.bookingFee);
  const rate = Math.min(1, Math.max(0, Number(discountRate) || 0));
  const discounted = round2(originalTotal - round2(originalTotal * rate));
  // Plancher de rémunération chauffeur : aucun tarif (ni remise) ne descend en dessous.
  const minimumNet = driverMinimumNet(meters, seconds + Math.max(0, Number(approachSeconds) || 0));
  const floorTotal = minimumPassengerTotal(minimumNet, rule.platformCommission);
  const total = Math.max(discounted, floorTotal);
  const discount = round2(Math.max(0, originalTotal - total));
  const driverFloorSupplement = round2(Math.max(0, total - originalTotal));
  const platformFee = feeFor(total, rule.platformCommission);
  return {
    baseFare: rule.baseFare,
    distanceFare,
    timeFare,
    surgeFare: subtotal * (multiplier - 1),
    surgeMultiplier: multiplier,
    bookingFee: rule.bookingFee,
    originalTotal,
    discountRate: discount > 0 ? rate : 0,
    discount,
    driverFloorSupplement,
    driverMinimumNet: minimumNet,
    approachSeconds: Math.max(0, Number(approachSeconds) || 0),
    total,
    estimatedTotal: total,
    platformCommission: rule.platformCommission,
    platformFee,
    driverEarnings: round2(total - platformFee),
    currency: "EUR",
  };
}

/**
 * À la fin de la course, enregistre le temps d'activité réel. Le passager paie le prix annoncé
 * et la plateforme conserve le tarif annoncé. La garantie horaire doit être contrôlée
 * séparément sur la période réglementaire, avec versement du complément éventuellement dû.
 */
export function settleDriverEarnings(fare, meters, activitySeconds) {
  return { ...fare, activitySeconds: Math.round(Math.max(0, Number(activitySeconds) || 0)) };
}

export function formatEuro(value = 0) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

// Modes de paiement passager : portefeuille (débité en fin de course), espèces (remises au chauffeur)
// ou carte (payée à la commande, créditée sur le portefeuille puis débitée en fin de course).
export const PAYMENT_METHODS = { wallet: "Portefeuille", cash: "Espèces", card: "Carte bancaire" };
export function paymentMethodOf(value) {
  return value === "cash" || value === "card" ? value : "wallet";
}
export function paymentMethodLabel(value) {
  return PAYMENT_METHODS[paymentMethodOf(value)];
}
/** Raison du refus de réservation, ou null. Le portefeuille exige un solde suffisant ; la carte, un solde non débiteur. */
export function bookingPaymentProblem(method, balance, total) {
  const m = paymentMethodOf(method);
  if (m === "cash") return null;
  if (m === "card")
    return Number(balance) < 0 ? "Votre portefeuille est débiteur : rechargez-le avant de réserver" : null;
  return Number(balance) < Number(total)
    ? "Solde insuffisant : rechargez votre portefeuille ou payez en espèces"
    : null;
}
/** Écriture sur le portefeuille du chauffeur pour une course en espèces : il garde le prix encaissé, la part plateforme est déduite. */
export function cashDriverWalletEntry(fare) {
  return round2((Number(fare.driverEarnings) || 0) - (Number(fare.total) || 0));
}
