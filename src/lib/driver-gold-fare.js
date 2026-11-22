// Apply the paid Gold benefit to the fare snapshot, without changing passenger totals.
// The rider/driver favorite relationship must be checked server-side before calling.
export function waiveGoldCommission(fare, ownPrivateClient = false) {
  const total = Number(fare.total ?? fare.estimatedTotal);
  if (!Number.isFinite(total) || total < 0) return fare;
  const rate = ownPrivateClient ? 0 : 15;
  const platformFee = Math.round(total * rate) / 100;
  const driverEarnings = Math.round((total - platformFee) * 100) / 100;
  if (fare.goldOriginalCommission) return fare;
  return {
    ...fare,
    goldOriginalCommission: {
      platformCommission: fare.platformCommission,
      platformFee: fare.platformFee,
      driverEarnings: fare.driverEarnings,
    },
    platformCommission: rate,
    platformFee,
    driverEarnings,
  };
}

export function restoreGoldCommission(fare) {
  const { goldOriginalCommission, ...rest } = fare;
  return goldOriginalCommission ? { ...rest, ...goldOriginalCommission } : fare;
}
