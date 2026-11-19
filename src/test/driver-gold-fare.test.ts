import { describe, expect, it } from "vitest";
import { restoreGoldCommission, waiveGoldCommission } from "@/lib/driver-gold-fare";

describe("commission du chauffeur Gold payant", () => {
  it("transfère les 5 % existants au chauffeur sans modifier le montant passager", () => {
    const regular = { total: 19.99, estimatedTotal: 19.99, platformCommission: 5, platformFee: 1, driverEarnings: 18.99 };
    const gold = waiveGoldCommission(regular);
    expect(gold).toMatchObject({ total: 19.99, estimatedTotal: 19.99, platformCommission: 0, platformFee: 0, driverEarnings: 19.99 });
    expect(waiveGoldCommission(gold)).toEqual(gold);
    expect(restoreGoldCommission(gold)).toEqual(regular);
  });
});
