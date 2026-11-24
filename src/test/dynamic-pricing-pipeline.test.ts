import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  config: null as any,
  fail: false,
  role: "rider",
  writes: [] as any[],
}));
function query(table: string) {
  let single = false,
    payload: any = null;
  const filters: any[] = [];
  const q: any = {
    select() {
      return q;
    },
    eq(k: string, v: any) {
      filters.push([k, v]);
      return q;
    },
    in() {
      return q;
    },
    single() {
      single = true;
      return q;
    },
    maybeSingle() {
      single = true;
      return q;
    },
    insert(v: any) {
      payload = v;
      return q;
    },
    then(resolve: any) {
      let data: any = [];
      let error: any = null;
      if (table === "user_roles") data = [{ role: state.role }];
      if (table === "profiles") data = { id: "self", balance: 100 };
      if (
        table === "pricing_rules" &&
        filters.some(([k, v]) => k === "vehicle_type" && v === "dynamic_pricing")
      ) {
        data = state.config ? { rule: state.config } : null;
        if (state.fail) error = { message: "unavailable" };
      }
      if (payload) {
        state.writes.push(payload);
        data = payload;
      }
      return Promise.resolve({ data, error }).then(resolve);
    },
  };
  return q;
}
const db = { from: query };
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table: string) => query(table) },
}));
import { estimates, handleVtc } from "@/lib/vtc.server";
import { defaultDynamicConfig } from "@/lib/dynamic-pricing";
const pickup = { lat: 48.5839, lng: 7.7455 },
  dropoff = { lat: 48.54, lng: 7.49 };
const context = () => ({ userId: "self", claims: { email: "self@example.test" }, supabase: db });
beforeEach(() => {
  state.config = defaultDynamicConfig();
  state.config.enabled = true;
  state.config.zones[0].schedule[0][12] = "very_low";
  state.config.zones[0].schedule[1][12] = "very_high";
  state.role = "rider";
  state.fail = false;
  state.writes = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-23T11:00Z"));
  vi.stubEnv("LOVABLE_API_KEY", "test");
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-map-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        routes: [
          {
            distanceMeters: 1000,
            duration: "300s",
            staticDuration: "300s",
            polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
          },
        ],
      }),
    ),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("application effective dans le pipeline serveur", () => {
  it("applique le même instant aux quatre catégories et le minimum net", async () => {
    const result = await estimates(db, pickup, dropoff);
    expect(Object.values(result.estimates).map((f: any) => f.total)).toEqual([
      10, 12.6, 11.2, 11.2,
    ]);
    expect(Object.values(result.estimates).every((f: any) => f.dynamicPricing.hour === 12)).toBe(
      true,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("utilise le créneau de départ prévu plutôt que celui de la commande", async () => {
    const quote = await estimates(db, pickup, dropoff, { departureAt: "2026-11-24T11:00Z" });
    expect(quote.estimates.economy.total).toBe(12);
    expect(quote.estimates.economy.dynamicPricing.day).toBe(1);
  });
  it("revient au barème classique si les paramètres ne sont pas accessibles", async () => {
    state.fail = true;
    const quote = await estimates(db, pickup, dropoff);
    expect(quote.estimates.economy.total).toBe(12);
    expect(quote.estimates.economy.dynamicPricing).toBeUndefined();
  });
  it("enregistre une réservation au prix serveur et ignore un montant client falsifié", async () => {
    const result = await handleVtc(
      {
        path: "/api/riders/me/scheduled-requests",
        method: "POST",
        body: {
          kind: "transport",
          transportType: "train",
          transportNumber: "TER123",
          scheduledAt: "2026-11-24T11:00Z",
          pickupAddress: "Centre Strasbourg",
          dropoffAddress: "Gare Molsheim",
          pickup,
          dropoff,
          vehicleType: "economy",
          estimatedPrice: 0.01,
        },
      },
      context(),
    );
    expect(result.request.estimated_price).toBe(12);
    expect(state.writes[0].scheduled_at).toBe("2026-11-24T11:00:00.000Z");
  });
  it("calcule une demande récurrente sur sa prochaine occurrence en heure de Paris", async () => {
    const result = await handleVtc(
      {
        path: "/api/riders/me/scheduled-requests",
        method: "POST",
        body: {
          kind: "recurring",
          weekday: 2,
          localTime: "12:00",
          pickupAddress: "Centre Strasbourg",
          dropoffAddress: "Gare Molsheim",
          pickup,
          dropoff,
          vehicleType: "pet",
          estimatedPrice: 0.01,
        },
      },
      context(),
    );
    expect(result.request.estimated_price).toBe(16);
    expect(result.request.weekday).toBe(2);
  });
  it("expose les paramètres uniquement à un administrateur vérifié", async () => {
    state.role = "admin";
    const result = await handleVtc({ path: "/api/admin/dynamic-pricing" }, context());
    expect(result.config).toEqual(state.config);
  });
});
