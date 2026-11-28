import { expect, it, vi } from "vitest";
import { fareForDriver } from "@/lib/driver-ride-fare.server";
import { hasPaidDriverGold, loadDriverGold } from "@/lib/driver-gold.server";
import { favoriteDriverId } from "@/lib/private-clients.server";

vi.mock("@/lib/driver-gold.server", () => ({ hasPaidDriverGold: vi.fn(), loadDriverGold: vi.fn() }));
vi.mock("@/lib/private-clients.server", () => ({ favoriteDriverId: vi.fn() }));

const fare = { total: 11.98, platformCommission: 10, platformFee: 1.2, driverEarnings: 10.78 };

it.each([
  ["priority favorite", "driver", true, false, 0, 11.98],
  ["paid favorite", "driver", false, true, 0, 11.98],
  ["ordinary Gold ride", "another", false, true, 5, 11.38],
  ["included Gold with another driver's client", "another", true, false, 10, 10.78],
  ["favorite on free trial", "driver", false, false, 10, 10.78],
] as const)("%s preserves passenger price and applies the matching commission", async (_, favorite, included, paid, rate, earnings) => {
  vi.mocked(favoriteDriverId).mockResolvedValue(favorite);
  vi.mocked(loadDriverGold).mockResolvedValue({
    active: true,
    included,
    status: included ? "included" : paid ? "active" : "trialing",
    endsAt: null,
    trialAvailable: false,
    canManage: !included,
    cancelAtPeriodEnd: false,
    unavailable: false,
  });
  vi.mocked(hasPaidDriverGold).mockResolvedValue(paid);
  const result = await fareForDriver({}, { fare, rider_id: "rider" }, "driver");
  expect(result).toMatchObject({ total: 11.98, platformCommission: rate, driverEarnings: earnings });
  expect(fare.driverEarnings).toBe(10.78);
});
