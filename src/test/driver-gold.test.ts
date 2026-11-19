import { describe, expect, it } from "vitest";
import { goldEntitlement } from "@/lib/driver-gold";

const end = "2026-11-26T12:00:00Z";
const before = Date.parse(end) - 1;
const atEnd = Date.parse(end);

describe("droits StrasDrive Gold", () => {
  it("inclut les chauffeurs prioritaires même sans abonnement ou avec un paiement en échec", () => {
    for (const billing of [null, { gold_status: "past_due" }]) {
      expect(goldEntitlement({ is_priority: true }, billing, atEnd)).toMatchObject({
        active: true, included: true, trialAvailable: false, endsAt: null,
      });
    }
  });

  it("accorde l’essai et l’abonnement jusqu’à leur échéance exacte", () => {
    for (const billing of [
      { gold_status: "trialing", gold_trial_ends_at: end, trial_used: true },
      { gold_status: "active", gold_current_period_end: end, trial_used: true, cancel_at_period_end: true },
    ]) {
      expect(goldEntitlement({}, billing, before)).toMatchObject({ active: true, endsAt: end });
      expect(goldEntitlement({}, billing, atEnd)).toMatchObject({ active: false, trialAvailable: false });
    }
  });

  it("refuse une période sans date ou impayée et restaure l’accès payé", () => {
    expect(goldEntitlement({}, null, before)).toMatchObject({ active: false, trialAvailable: true });
    expect(goldEntitlement({}, { gold_status: "active" }, before).active).toBe(false);
    const billing = { gold_status: "past_due", gold_current_period_end: end, trial_used: true };
    expect(goldEntitlement({}, billing, before).active).toBe(false);
    expect(goldEntitlement({}, { ...billing, gold_status: "active" }, before).active).toBe(true);
  });
});
