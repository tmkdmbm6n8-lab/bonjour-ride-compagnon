import { describe, it, expect } from "vitest";
import { prepareHourlyReconciliation } from "../lib/vtc-arpe-reconciliation";

describe("ARPE hourly reconciliation", () => {
  const period = { periodStart: "2026-11-01T00:00:00Z", periodEnd: "2026-12-01T00:00:00Z" };
  it("computes a supplement from completed rides with real timestamps", () => {
    const result = prepareHourlyReconciliation([{
      id: "ride-1", status: "completed", is_test: false,
      accepted_at: "2026-11-02T10:00:00Z",
      started_at: "2026-11-02T10:10:00Z",
      completed_at: "2026-11-02T10:50:00Z",
      fare: { driverEarnings: 15 },
    }], period);
    expect(result.includedCount).toBe(1);
    expect(result.guaranteed).toBe(25);
    expect(result.supplementDue).toBe(10);
    expect(result.readyForPayment).toBe(false);
  });
  it("excludes missing timestamps instead of inventing durations", () => {
    const result = prepareHourlyReconciliation([{
      id: "ride-2", status: "completed", completed_at: "2026-11-02T10:50:00Z",
      accepted_at: "2026-11-02T10:00:00Z", fare: { driverEarnings: 15 },
    }], period);
    expect(result.includedCount).toBe(0);
    expect(result.excluded).toHaveLength(1);
    expect(result.supplementDue).toBe(0);
  });
  it("rejects missing earnings rather than treating them as zero", () => {
    const result = prepareHourlyReconciliation([{
      id: "ride-missing", status: "completed",
      accepted_at: "2026-11-02T10:00:00Z", started_at: "2026-11-02T10:10:00Z",
      completed_at: "2026-11-02T10:50:00Z", fare: {},
    }], period);
    expect(result.includedCount).toBe(0);
    expect(result.needsReview).toBe(true);
    expect(result.readyForPayment).toBe(false);
  });
  it("does not double count a ride", () => {
    const ride = { id: "ride-3", status: "completed", accepted_at: "2026-11-02T10:00:00Z",
      started_at: "2026-11-02T10:00:00Z", completed_at: "2026-11-02T11:00:00Z",
      fare: { driverEarnings: 20 } };
    const result = prepareHourlyReconciliation([ride, ride], period);
    expect(result.includedCount).toBe(1);
    expect(result.excluded).toHaveLength(1);
  });
});
