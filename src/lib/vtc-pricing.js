// Validated distance/time tariff. Amounts are euros; durations are seconds.
export const TARIFF_VERSION = "distance-time-2026-11-24";
export const DEFAULT_PRICING = {
  economy: { baseFare: 1.90, perKmRate: 0.99, perMinRate: 0.29, minimumFare: 12, supplement: 0, bookingFee: 0, platformCommission: 10, surgeMultiplierCap: 1 },
  comfort: { baseFare: 2.43, perKmRate: 1.27, perMinRate: 0.37, minimumFare: 18, supplement: 0, bookingFee: 0, platformCommission: 10, surgeMultiplierCap: 1 },
  pet: { baseFare: 1.90, perKmRate: 0.99, perMinRate: 0.29, minimumFare: 12, supplement: 4, bookingFee: 0, platformCommission: 10, surgeMultiplierCap: 1 },
  xl: { baseFare: 6.93, perKmRate: 1.49, perMinRate: 0.49, minimumFare: 16, supplement: 0, bookingFee: 0, platformCommission: 10, surgeMultiplierCap: 1 },
};
export const TARIFF_FIELDS = ['baseFare', 'perKmRate', 'perMinRate', 'minimumFare', 'supplement'];
export function tariffRuleProblem(value) {
  return TARIFF_FIELDS.some(key => typeof value?.[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < 0 || value[key] > 10000)
    ? 'Renseignez des montants compris entre 0 et 10 000 € pour chaque champ.' : null;
}
// Legacy database rules are ignored until explicitly saved for this tariff version.
export function pricingRules(rows = []) {
  return Object.fromEntries(Object.entries(DEFAULT_PRICING).map(([type, defaults]) => {
    const saved = rows.find(row => row.vehicle_type === type)?.rule;
    const fields = saved?.tariffVersion === TARIFF_VERSION && !tariffRuleProblem(saved)
      ? Object.fromEntries(TARIFF_FIELDS.map(key => [key, saved[key]])) : {};
    return [type, { ...defaults, ...fields }];
  }));
}
// Aucune remise proportionnelle : seuls les prix entiers peuvent recevoir un ajustement de 0,02 €.
export const DISCOUNT_RATE = 0;

// Rémunération minimale des chauffeurs (accord ARPE VTC), montants nets de commission.
export const DRIVER_MIN_NET_PER_RIDE = 9; // € nets par course, quelle que soit la distance ou la durée
export const DRIVER_MIN_NET_PER_HOUR = 30; // € nets par heure d'activité, temps d'approche compris
export const DRIVER_MIN_NET_PER_KM = 1; // € nets par kilomètre parcouru
// Temps d’approche de référence pour le suivi séparé de la rémunération.
export const ESTIMATED_APPROACH_SECONDS = 300;

const round2 = (n) => Math.round((n + Number.EPSILON * Math.max(1, Math.abs(n))) * 100) / 100;
const ceil2 = (n) => Math.ceil(Math.round(n * 1e6) / 1e4) / 100;
const feeFor = (total, commission) => Math.round(total * commission) / 100;

/** Paramètres de suivi de rémunération, distincts du prix passager fixé au devis. */
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

/** Prix TTC fixé au devis : max(minimum, base + kilomètres + minutes), puis supplément. */
export function calculateFare(rule, meters, seconds) {
  if (!Number.isFinite(meters) || meters < 0 || !Number.isFinite(seconds) || seconds < 0) throw new Error('Distance ou durée de trajet invalide');
  if (tariffRuleProblem(rule)) throw new Error('Barème de tarification invalide');
  const distanceFare = meters / 1000 * rule.perKmRate;
  const timeFare = seconds / 60 * rule.perMinRate;
  const subtotal = rule.baseFare + distanceFare + timeFare;
  const minimumFareSupplement = Math.max(0, rule.minimumFare - subtotal);
  const originalTotal = round2(Math.max(subtotal, rule.minimumFare) + rule.supplement);
  if (!Number.isFinite(originalTotal)) throw new Error('Montant de trajet invalide');
  const platformCommission = rule.platformCommission;
  if (!Number.isFinite(platformCommission) || platformCommission < 0 || platformCommission >= 100) throw new Error('Commission invalide');
  // Leave cent amounts untouched. Apply the price ending once, only on new quotes,
  // and never reduce the driver's net earnings below the existing configured floor.
  const candidate = round2(originalTotal - 0.02);
  const priceEndingDiscount = originalTotal > 0 && Math.round(originalTotal * 100) % 100 === 0 &&
    round2(candidate - feeFor(candidate, platformCommission)) >= driverMinimumNet(meters, seconds) ? 0.02 : 0;
  const total = round2(originalTotal - priceEndingDiscount);
  const platformFee = feeFor(total, platformCommission);
  return {
    baseFare: rule.baseFare, distanceFare, timeFare, minimumFare: rule.minimumFare,
    minimumFareSupplement: round2(minimumFareSupplement), supplement: rule.supplement,
    surgeFare: 0, surgeMultiplier: 1, bookingFee: 0,
    originalTotal, priceEndingDiscount, discountRate: originalTotal > 0 ? priceEndingDiscount / originalTotal : 0, discount: priceEndingDiscount,
    driverFloorSupplement: 0, total, estimatedTotal: total,
    platformCommission, platformFee, driverEarnings: round2(total - platformFee),
    currency: 'EUR', priceSource: 'tariff', tariffVersion: TARIFF_VERSION,
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
