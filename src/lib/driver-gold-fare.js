// Snapshot the subscription benefit when the driver accepts. Passenger totals and
// the original quoted fare remain available if the ride needs another driver.
export function waiveGoldCommission(fare) {
  const fee = Number(fare.platformFee);
  if (!(fee > 0)) return fare;
  return {
    ...fare,
    goldOriginalCommission: {
      platformCommission: fare.platformCommission,
      platformFee: fare.platformFee,
      driverEarnings: fare.driverEarnings,
    },
    platformCommission: 0,
    platformFee: 0,
    driverEarnings: Math.round((Number(fare.driverEarnings) + fee) * 100) / 100,
  };
}

export function restoreGoldCommission(fare) {
  const { goldOriginalCommission, ...rest } = fare;
  return goldOriginalCommission ? { ...rest, ...goldOriginalCommission } : fare;
}
