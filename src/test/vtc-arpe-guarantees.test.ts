import { describe, expect, it } from "vitest";
import { eligibleActivitySeconds, hourlyGuaranteeStatement } from "@/lib/vtc-arpe-guarantees";

describe("ARPE hourly guarantee (periodic reconciliation)", () => {
  it("counts actual approach time for an immediate booking", () => {
    expect(eligibleActivitySeconds({ rideSeconds: 1200, approachSeconds: 600 })).toBe(1800);
  });
  it("caps advance-booking approach allowance to 15% of ride time and 5 minutes", () => {
    expect(eligibleActivitySeconds({ rideSeconds: 1200, approachSeconds: 900, advanceBooking: true })).toBe(1380);
    expect(eligibleActivitySeconds({ rideSeconds: 3600, approachSeconds: 900, advanceBooking: true })).toBe(3900);
  });
  it("calculates a period supplement without changing passenger fares", () => {
    const result = hourlyGuaranteeStatement([{ rideSeconds: 1800, approachSeconds: 1800, driverEarnings: 20 }]);
    expect(result.guaranteed).toBe(30);
    expect(result.supplementDue).toBe(10);
  });
  it("does not count tips as activity income", () => {
    expect(hourlyGuaranteeStatement([{ rideSeconds: 3600, driverEarnings: 20, tips: 50, bonuses: 5 }]).supplementDue).toBe(5);
  });
});
