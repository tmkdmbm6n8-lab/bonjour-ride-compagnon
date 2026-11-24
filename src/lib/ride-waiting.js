export const FREE_WAIT_SECONDS = 120;
export const PICKUP_WAIT_RATE = { economy: 72, comfort: 98, xl: 98 };

export function waitingRate(category, driverClass) {
  const rate = category === "pet" ? driverClass : category;
  return Object.hasOwn(PICKUP_WAIT_RATE, rate) ? PICKUP_WAIT_RATE[rate] : PICKUP_WAIT_RATE.economy;
}

export function pickupWaiting(start, end, rate) {
  const startMs = Date.parse(start);
  const endMs = typeof end === "number" ? end : Date.parse(end);
  const seconds = Number.isFinite(startMs) && Number.isFinite(endMs)
    ? Math.max(0, Math.floor((endMs - startMs) / 1000)) : 0;
  const billableSeconds = Math.max(0, seconds - FREE_WAIT_SECONDS);
  return { seconds, billableSeconds, cents: Math.floor(billableSeconds * rate / 60) };
}

export function addPickupWaiting(fare, arrivedAt, startedAt) {
  if (!fare.pickupWaitingRate || fare.pickupWaiting) return fare;
  const waiting = pickupWaiting(arrivedAt, startedAt, fare.pickupWaitingRate);
  const amount = waiting.cents / 100;
  const totalCents = Math.round(fare.total * 100) + waiting.cents;
  const feeCents = Math.round(totalCents * fare.platformCommission / 100);
  return {
    ...fare,
    pickupWaiting: { ...waiting, rate: fare.pickupWaitingRate, amount },
    total: totalCents / 100,
    platformFee: feeCents / 100,
    driverEarnings: (totalCents - feeCents) / 100,
  };
}
