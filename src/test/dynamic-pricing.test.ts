import { describe, it, expect } from "vitest";
import {
  defaultDynamicConfig,
  validateDynamicConfig,
  LEVELS,
  parisSlot,
  zoneForPoint,
  simulateDynamicPrice,
  applyDynamicPricing,
  emptySchedule,
} from "@/lib/dynamic-pricing";
import { calculateFare, DEFAULT_PRICING, settleDriverEarnings } from "@/lib/vtc-pricing";
import { waiveGoldCommission } from "@/lib/driver-gold-fare";
import {
  parisFormInstant,
  parisFormValue,
  plannedDeparture,
  nextWeeklyDeparture,
} from "@/lib/scheduled-pricing";
function active() {
  const c = defaultDynamicConfig();
  c.enabled = true;
  c.zones[0].schedule[0][12] = "very_low";
  return c;
}
const fare = calculateFare(DEFAULT_PRICING.economy, 1000, 300);
const options = (config: any) => ({
  config,
  pickup: { lat: 48.5839, lng: 7.7455 },
  category: "economy",
  departureAt: "2026-11-23T11:00:00Z",
  meters: 1000,
  seconds: 300,
});
describe("tarification dynamique autonome", () => {
  it("initialise 1176 créneaux dont 840 historiques et 336 neutres, désactivée", () => {
    const c = defaultDynamicConfig();
    expect(c.enabled).toBe(false);
    expect(c.zones.flatMap((z) => z.schedule.flat())).toHaveLength(1176);
    expect(c.zones.flatMap((z) => z.schedule.flat()).filter(Boolean)).toHaveLength(840);
    expect(validateDynamicConfig(c)).toEqual(c);
    c.zones[0].schedule[0][0] = "low";
    expect(defaultDynamicConfig().zones[0].schedule[0][0]).toBe(null);
  });
  it.each(LEVELS.map((l, i) => [l.id, [12.44, 13.33, 15.1, 16.88, 17.77][i]]))(
    "reproduit 17,77 € au niveau %s",
    (level, price) => {
      const c = active();
      c.zones[0].schedule[0][12] = level as string;
      expect(
        simulateDynamicPrice(c, {
          initialPrice: 17.77,
          zoneId: c.zones[0].id,
          day: 0,
          hour: 12,
          category: "economy",
        }).finalPrice,
      ).toBe(price);
    },
  );
  it("accepte majorations, décimales et surcharge nulle par catégorie", () => {
    const c = active();
    c.levels[0].percent = 12.5;
    c.levels[0].byCategory = { pet: 0, xl: 50 };
    for (const [category, percent] of [
      ["economy", 12.5],
      ["pet", 0],
      ["xl", 50],
    ])
      expect(
        simulateDynamicPrice(c, {
          initialPrice: 20,
          zoneId: c.zones[0].id,
          day: 0,
          hour: 12,
          category,
        }).percent,
      ).toBe(percent);
  });
  it.each(["disabled", "outside", "unknown", "broken"])(
    "garde exactement le barème : %s",
    (reason) => {
      const c = active();
      const o = options(c);
      if (reason === "disabled") c.enabled = false;
      if (reason === "outside") o.pickup = { lat: 0, lng: 0 };
      if (reason === "unknown") c.zones[0].schedule[0][12] = null;
      if (reason === "broken") c.zones = null as any;
      expect(applyDynamicPricing(fare, o)).toBe(fare);
    },
  );
  it("limite la réduction au minimum chauffeur sans changer la commission", () => {
    const c = active();
    c.levels[0].percent = -100;
    const f = applyDynamicPricing(fare, options(c));
    expect(f.total).toBe(10);
    expect(f.driverEarnings).toBe(9);
    expect(f.platformCommission).toBe(fare.platformCommission);
    expect(f.dynamicPricing.minimumProtected).toBe(true);
    expect(fare.total).toBe(12);
  });
  it("protège aussi le minimum kilométrique", () => {
    const f = applyDynamicPricing({ ...fare, total: 30 }, { ...options(active()), meters: 20000 });
    expect(f.driverEarnings).toBeGreaterThanOrEqual(20);
  });
  it("fige la course acceptée et conserve les règles Gold", () => {
    const c = active();
    const quoted = applyDynamicPricing(fare, options(c));
    const before = JSON.stringify(quoted);
    c.levels[0].percent = 100;
    expect(settleDriverEarnings(quoted, 10000, 7200).total).toBe(quoted.total);
    expect(JSON.stringify(quoted)).toBe(before);
    expect(waiveGoldCommission(quoted).total).toBe(quoted.total);
    expect(waiveGoldCommission(quoted, true).platformCommission).toBe(0);
  });
  it("applique une majoration et expose un détail comptable cohérent", () => {
    const c = active();
    c.levels[0].percent = 25;
    const f = applyDynamicPricing(fare, options(c));
    expect(f.total).toBe(15);
    expect(f.dynamicPricing.amount).toBe(3);
    expect(f.platformFee + f.driverEarnings).toBe(f.total);
  });
  it("classe le point dans chaque centre de zone et exclut les zones désactivées", () => {
    const c = active();
    for (const z of c.zones) expect(zoneForPoint(c.zones, z)?.id).toBe(z.id);
    c.zones[0].enabled = false;
    expect(zoneForPoint([c.zones[0]], c.zones[0])).toBe(null);
    expect(zoneForPoint(c.zones, { lat: NaN, lng: 7 })).toBe(null);
  });
  it("gère ajout, suppression et planning indépendant des zones", () => {
    const c = active();
    c.zones.push({
      id: "new",
      name: "Zone",
      lat: 0,
      lng: 0,
      radiusKm: 1,
      enabled: true,
      schedule: emptySchedule(),
    });
    c.zones.shift();
    expect(validateDynamicConfig(c).zones).toHaveLength(7);
    expect(
      c.zones
        .at(-1)
        ?.schedule.flat()
        .every((x) => x === null),
    ).toBe(true);
  });
  it.each(["percent", "duplicate", "hour", "coords"])(
    "rejette une configuration invalide : %s",
    (kind) => {
      const c = active();
      if (kind === "percent") c.levels[0].percent = -101;
      if (kind === "duplicate") c.zones[1].id = c.zones[0].id;
      if (kind === "hour") c.zones[0].schedule[0].pop();
      if (kind === "coords") c.zones[0].lat = 91;
      expect(() => validateDynamicConfig(c)).toThrow();
    },
  );
  it.each([
    ["2026-11-23T23:30:00Z", 1, 0],
    ["2026-07-06T22:30:00Z", 1, 0],
    ["2026-03-29T00:30:00Z", 6, 1],
    ["2026-03-29T01:30:00Z", 6, 3],
    ["2026-10-25T00:30:00Z", 6, 2],
    ["2026-10-25T01:30:00Z", 6, 2],
  ])("respecte Paris et les changements d’heure : %s", (date, day, hour) => {
    expect(parisSlot(date)).toEqual({ day, hour });
  });
  it("affecte les barres après minuit au jour civil suivant", () => {
    const c = defaultDynamicConfig();
    expect(c.zones.every((z) => z.schedule[0].every((v) => v === null))).toBe(true);
    expect(c.zones.every((z) => z.schedule[6].slice(0, 4).every(Boolean))).toBe(true);
    expect(c.zones.every((z) => z.schedule[6].slice(4).every((v) => v === null))).toBe(true);
  });
  it("convertit les réservations depuis Paris même hors du fuseau du navigateur", () => {
    expect(parisFormInstant("2026-07-06T12:30")).toBe("2026-07-06T10:30:00.000Z");
    expect(parisFormValue("2026-11-23T11:30Z")).toBe("2026-11-23T12:30");
    expect(parisFormInstant("2026-03-29T02:30")).toBe(null);
    expect(nextWeeklyDeparture(1, "12:00", new Date("2026-11-23T12:00Z"))).toBe(
      "2026-11-30T11:00:00.000Z",
    );
    expect(() => plannedDeparture("2026-11-23T12:00")).toThrow(/fuseau/);
    expect(() => plannedDeparture("2020-01-01T12:00Z")).toThrow(/futures/);
  });
});
