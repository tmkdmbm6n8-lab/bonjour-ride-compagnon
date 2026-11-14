export const DEFAULT_PRICING = {
  economy: {baseFare:2,perKmRate:1,perMinRate:.15,minimumFare:4,bookingFee:.5,platformCommission:5,surgeMultiplierCap:3},
  comfort: {baseFare:3,perKmRate:1.5,perMinRate:.25,minimumFare:6.5,bookingFee:.75,platformCommission:5,surgeMultiplierCap:3},
  premium: {baseFare:5,perKmRate:2.5,perMinRate:.4,minimumFare:12,bookingFee:1,platformCommission:10,surgeMultiplierCap:3},
  xl: {baseFare:4,perKmRate:1.8,perMinRate:.3,minimumFare:8,bookingFee:.75,platformCommission:5,surgeMultiplierCap:3},
};
// Taux de remise appliqué au tarif calculé (0.20 = 20 %). Mettre à 0 pour retirer la remise.
export const DISCOUNT_RATE = 0;

// Rémunération minimale des chauffeurs (accord ARPE VTC), montants nets de commission.
export const DRIVER_MIN_NET_PER_RIDE = 9;   // € nets par course, quelle que soit la distance ou la durée
export const DRIVER_MIN_NET_PER_HOUR = 30;  // € nets par heure d'activité, temps d'approche compris
export const DRIVER_MIN_NET_PER_KM = 1;     // € nets par kilomètre parcouru
// Temps d'approche estimé, inclus dans le devis passager. Le temps réel est vérifié à la fin de la course.
export const ESTIMATED_APPROACH_SECONDS = 300;

const round2 = (n) => Math.round(n * 100) / 100;
const ceil2 = (n) => Math.ceil(Math.round(n * 1e6) / 1e4) / 100;
const feeFor = (total, commission) => Math.round(total * commission) / 100;

/** Revenu net minimum dû au chauffeur pour une course (le plus élevé des trois planchers). */
export function driverMinimumNet(meters, activitySeconds) {
  const km = Math.max(0, Number(meters) || 0) / 1000;
  const hours = Math.max(0, Number(activitySeconds) || 0) / 3600;
  return ceil2(Math.max(DRIVER_MIN_NET_PER_RIDE, km * DRIVER_MIN_NET_PER_KM, hours * DRIVER_MIN_NET_PER_HOUR));
}

/** Prix passager minimum pour que le chauffeur touche `net` après la commission (en %). */
export function minimumPassengerTotal(net, commission) {
  const c = Math.min(99, Math.max(0, Number(commission) || 0));
  let total = ceil2(net / (1 - c / 100));
  while (round2(total - feeFor(total, c)) < net) total = round2(total + 0.01);
  return total;
}

export function calculateFare(rule, meters, seconds, surge=1, discountRate=DISCOUNT_RATE, approachSeconds=ESTIMATED_APPROACH_SECONDS) {
 const distanceFare=meters/1000*rule.perKmRate,timeFare=seconds/60*rule.perMinRate;
 const subtotal=rule.baseFare+distanceFare+timeFare;
 const multiplier=Math.min(rule.surgeMultiplierCap,Math.max(1,surge));
 const originalTotal=round2(Math.max(subtotal*multiplier,rule.minimumFare)+rule.bookingFee);
 const rate=Math.min(1,Math.max(0,Number(discountRate)||0));
 const discounted=round2(originalTotal-round2(originalTotal*rate));
 // Plancher de rémunération chauffeur : aucun tarif (ni remise) ne descend en dessous.
 const minimumNet=driverMinimumNet(meters,seconds+Math.max(0,Number(approachSeconds)||0));
 const floorTotal=minimumPassengerTotal(minimumNet,rule.platformCommission);
 const total=Math.max(discounted,floorTotal);
 const discount=round2(Math.max(0,originalTotal-total));
 const driverFloorSupplement=round2(Math.max(0,total-originalTotal));
 const platformFee=feeFor(total,rule.platformCommission);
 return {baseFare:rule.baseFare,distanceFare,timeFare,surgeFare:subtotal*(multiplier-1),surgeMultiplier:multiplier,bookingFee:rule.bookingFee,originalTotal,discountRate:discount>0?rate:0,discount,driverFloorSupplement,driverMinimumNet:minimumNet,approachSeconds:Math.max(0,Number(approachSeconds)||0),total,estimatedTotal:total,platformCommission:rule.platformCommission,platformFee,driverEarnings:round2(total-platformFee),currency:'EUR'};
}

/**
 * À la fin de la course, vérifie la rémunération avec le temps d'activité réel
 * (de l'acceptation à l'arrivée, approche comprise). Le passager paie le prix annoncé ;
 * si le chauffeur passerait sous le plancher, la plateforme complète sur sa commission.
 */
export function settleDriverEarnings(fare, meters, activitySeconds) {
  const due=driverMinimumNet(meters,activitySeconds);
  const earned=Number(fare.driverEarnings)||0;
  if(earned>=due)return {...fare,activitySeconds:Math.round(activitySeconds)};
  const topUp=round2(due-earned);
  return {...fare,activitySeconds:Math.round(activitySeconds),driverEarnings:due,platformFee:round2((Number(fare.total)||0)-due),platformTopUp:topUp};
}

export function formatEuro(value=0) { return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(value); }
