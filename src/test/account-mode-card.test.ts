// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ createSession: vi.fn(), createCustomer: vi.fn() }));
vi.mock("@/lib/stripe.server", () => ({
  createStripeClient: () => ({
    customers: {
      search: async () => ({ data: [] }),
      list: async () => ({ data: [] }),
      create: mock.createCustomer,
    },
    checkout: { sessions: { create: mock.createSession } },
  }),
  getStripeErrorMessage: () => "Erreur test",
}));
import { handleCheckout } from "@/lib/vtc-checkout.server";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_URL", "https://example.test");
  vi.stubEnv("PAYMENTS_STRIPE_ENV", "sandbox");
  mock.createSession.mockResolvedValue({ id: "session", client_secret: "secret_test" });
  mock.createCustomer.mockResolvedValue({ id: "customer" });
});
function params(role: string) {
  const admin = {
    from: () => {
      const q = {
        insert: () => q,
        select: () => q,
        single: async () => ({ data: { id: "booking" }, error: null }),
        update: () => q,
        eq: () => ({ error: null, select: async () => ({ data: [{ id: "booking" }], error: null }) }),
      };
      return q;
    },
  };
  return {
    admin,
    uid: "self",
    role,
    email: "self@example.test",
    p: "/api/rides/card-checkout",
    q: new URLSearchParams(),
    method: "POST",
    body: { environment: "sandbox", origin: "https://example.test", vehicleType: "economy" },
    preparePassenger: vi.fn().mockResolvedValue(undefined),
    quoteRide: vi.fn().mockResolvedValue({ fare: { total: 42 }, route: { distanceMeters: 3000 } }),
    cardBookingProblem: () => null,
    createRide: vi.fn(),
    serializeRide: vi.fn(),
  };
}
describe("réservation carte en mode passager", () => {
  it.each(["driver", "admin"])(
    "autorise le compte %s en conservant le tarif serveur",
    async (role) => {
      const input = params(role);
      const result = await handleCheckout(input);
      expect(result.sessionId).toBe("session");
      expect(input.preparePassenger).toHaveBeenCalledOnce();
      expect(input.preparePassenger.mock.invocationCallOrder[0]).toBeLessThan(
        input.quoteRide.mock.invocationCallOrder[0],
      );
      expect(mock.createSession.mock.calls[0][0].line_items[0].price_data.unit_amount).toBe(4200);
    },
  );
  it("refuse un environnement Stripe différent de celui du serveur", async () => {
    const input = params("driver");
    input.body.environment = "live";
    await expect(handleCheckout(input)).rejects.toThrow(/non autorisé/);
    expect(mock.createSession).not.toHaveBeenCalled();
  });
  it("ne remet pas une session de paiement au client si son enregistrement échoue", async () => {
    const input = params("driver");
    const baseFrom = input.admin.from;
    input.admin.from = () => {
      const query = baseFrom();
      query.update = () => ({ eq: () => ({ select: async () => ({ data: null, error: { message: "Database unavailable" } }) }) });
      return query;
    };
    const result = await handleCheckout(input);
    expect(result.error).toMatch(/non enregistrée/);
    expect(result.clientSecret).toBeUndefined();
  });
  it("ne prépare pas de paiement si le conflit de course bloque la bascule", async () => {
    const input = params("driver");
    input.preparePassenger.mockRejectedValue(new Error("Course active"));
    await handleCheckout(input);
    expect(input.quoteRide).not.toHaveBeenCalled();
    expect(mock.createSession).not.toHaveBeenCalled();
  });
});
