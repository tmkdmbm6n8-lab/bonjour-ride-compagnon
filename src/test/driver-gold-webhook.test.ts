import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncGoldEvent } from "@/lib/driver-gold.server";

const stripe = vi.hoisted(() => ({ subscriptions: { list: vi.fn() } }));
vi.mock("@/lib/stripe.server", () => ({ createStripeClient: () => stripe }));

const owner = { driver_id: "driver", environment: "sandbox", stripe_customer_id: "cus_gold" };
const event = (type: string) => ({ type, data: { object: { object: "invoice", customer: owner.stripe_customer_id } } });
const subscription = (invoiceStatus: string) => ({
  id: "sub_gold", status: "active", metadata: { kind: "strasdrive_gold" },
  trial_start: 1_795_694_400,
  items: { data: [{
    current_period_end: 1_798_286_400,
    price: { unit_amount: 1999, currency: "eur", tax_behavior: "inclusive", recurring: { interval: "month", interval_count: 1 } },
  }] },
  latest_invoice: {
    status: invoiceStatus, collection_method: "charge_automatically", attempt_count: 1,
    amount_remaining: invoiceStatus === "paid" ? 0 : 1999,
  },
});

function billingStore() {
  let row = { ...owner, revision: 0, gold_status: "inactive", trial_used: false };
  let conflict = false;
  const admin = {
    from() {
      const filters: Record<string, unknown> = {};
      let patch: Partial<typeof row> | undefined;
      const query = {
        select: () => query,
        update(value: Partial<typeof row>) { patch = value; return query; },
        eq(key: string, value: unknown) { filters[key] = value; return query; },
        async maybeSingle() {
          if (patch && conflict) {
            conflict = false;
            row = { ...row, revision: row.revision + 1 };
            return { data: null, error: null };
          }
          if (filters.revision != null && filters.revision !== row.revision) return { data: null, error: null };
          if (patch) row = { ...row, ...patch };
          return { data: { ...row }, error: null };
        },
      };
      return query;
    },
  };
  return { admin, read: () => row, conflictNextWrite() { conflict = true; } };
}

beforeEach(() => vi.stubEnv("GOLD_STRIPE_ENV", "sandbox"));
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

describe("synchronisation Stripe Gold", () => {
  it("désactive un renouvellement impayé et réactive après paiement, même avec des événements en retard", async () => {
    const { admin, read } = billingStore();
    stripe.subscriptions.list.mockReturnValue([subscription("open")]);
    await syncGoldEvent(admin, "sandbox", event("invoice.payment_failed"));
    expect(read()).toMatchObject({ gold_status: "past_due", trial_used: true });
    stripe.subscriptions.list.mockReturnValue([subscription("paid")]);
    await syncGoldEvent(admin, "sandbox", event("invoice.payment_succeeded"));
    await syncGoldEvent(admin, "sandbox", event("invoice.payment_failed"));
    expect(read()).toMatchObject({ gold_status: "active", trial_used: true });
  });

  it("relit Stripe après un conflit d’écriture et ignore l’autre environnement", async () => {
    const { admin, read, conflictNextWrite } = billingStore();
    conflictNextWrite();
    stripe.subscriptions.list.mockReturnValueOnce([subscription("open")]).mockReturnValueOnce([subscription("paid")]);
    await syncGoldEvent(admin, "live", event("invoice.payment_failed"));
    expect(stripe.subscriptions.list).not.toHaveBeenCalled();
    await syncGoldEvent(admin, "sandbox", event("invoice.payment_failed"));
    expect(stripe.subscriptions.list).toHaveBeenCalledTimes(2);
    expect(read()).toMatchObject({ gold_status: "active", revision: 2 });
  });
});
