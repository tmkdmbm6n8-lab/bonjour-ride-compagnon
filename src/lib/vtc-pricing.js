export const DEFAULT_PRICING = {
  economy: {baseFare:2,perKmRate:1,perMinRate:.15,minimumFare:4,bookingFee:.5,platformCommission:8,surgeMultiplierCap:3},
  comfort: {baseFare:3,perKmRate:1.5,perMinRate:.25,minimumFare:6.5,bookingFee:.75,platformCommission:8,surgeMultiplierCap:3},
  premium: {baseFare:5,perKmRate:2.5,perMinRate:.4,minimumFare:12,bookingFee:1,platformCommission:10,surgeMultiplierCap:3},
  xl: {baseFare:4,perKmRate:1.8,perMinRate:.3,minimumFare:8,bookingFee:.75,platformCommission:8,surgeMultiplierCap:3},
};
// Taux de remise appliqué au tarif calculé (0.20 = 20 %). Mettre à 0 pour retirer la remise.
export const DISCOUNT_RATE = 0.20;
const round2 = (n) => Math.round(n * 100) / 100;
export function calculateFare(rule, meters, seconds, surge=1, discountRate=DISCOUNT_RATE) {
 const distanceFare=meters/1000*rule.perKmRate,timeFare=seconds/60*rule.perMinRate;
 const subtotal=rule.baseFare+distanceFare+timeFare;
 const multiplier=Math.min(rule.surgeMultiplierCap,Math.max(1,surge));
 const originalTotal=round2(Math.max(subtotal*multiplier,rule.minimumFare)+rule.bookingFee);
 const rate=Math.min(1,Math.max(0,Number(discountRate)||0));
 const discount=round2(originalTotal*rate);
 const total=round2(originalTotal-discount);
 const platformFee=Math.round(total*rule.platformCommission)/100;
 return {baseFare:rule.baseFare,distanceFare,timeFare,surgeFare:subtotal*(multiplier-1),surgeMultiplier:multiplier,bookingFee:rule.bookingFee,originalTotal,discountRate:rate,discount,total,estimatedTotal:total,platformFee,driverEarnings:round2(total-platformFee),currency:'EUR'};
}
export function formatEuro(value=0) { return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(value); }
