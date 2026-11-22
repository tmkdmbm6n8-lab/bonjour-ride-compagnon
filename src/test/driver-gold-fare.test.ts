import { describe, expect, it } from "vitest";
import { restoreGoldCommission, waiveGoldCommission } from "@/lib/driver-gold-fare";

const regular = { total: 20, estimatedTotal: 20, platformCommission: 15, platformFee: 3, driverEarnings: 17 };

describe("commissions Gold payant", () => {
  it("maintient 15 % pour un client ordinaire", () => {
    const gold = waiveGoldCommission(regular);
    expect(gold).toMatchObject({ total: 20, platformCommission: 15, platformFee: 3, driverEarnings: 17 });
    expect(waiveGoldCommission(gold)).toEqual(gold);
    expect(restoreGoldCommission(gold)).toEqual(regular);
  });
  it("applique 0 % uniquement pour le propre client privé", () => {
    const gold = waiveGoldCommission(regular, true);
    expect(gold).toMatchObject({ total: 20, platformCommission: 0, platformFee: 0, driverEarnings: 20 });
    expect(restoreGoldCommission(gold)).toEqual(regular);
  });
  it("arrondit les centimes sans modifier le montant passager", () => {
    const gold = waiveGoldCommission({ ...regular, total: 19.99, estimatedTotal: 19.99 });
    expect(gold).toMatchObject({ total: 19.99, platformFee: 3, driverEarnings: 16.99 });
  });
});
