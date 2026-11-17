import { describe, expect, it } from "vitest";
import { canReceiveNextRide, nextRideEligibility } from "@/lib/vtc-next-ride";
const now = Date.parse("2026-11-17T12:00:00Z");
const point = { lat: 48.57, lng: 7.75 },
  pickup = { lat: 48.58, lng: 7.76 };
const driver = {
  user_id: "driver",
  is_online: true,
  is_approved: true,
  vehicle_class: "economy",
  accepts_classes: ["economy"],
};
const currentRide = { id: "current", driver_id: "driver", status: "in_progress", dropoff: point };
const liveRoute = {
  source: "google",
  traffic: true,
  approximate: false,
  durationSeconds: 180,
  at: new Date(now).toISOString(),
  status: "in_progress",
  target: "dropoff",
};
const nextRide = {
  id: "next",
  status: "searching",
  vehicle_type: "economy",
  pickup,
  payment: { method: "wallet" },
  rider_rating: 5,
  fare: { driverEarnings: 20 },
  route: { distanceMeters: 5000 },
};
const approachRoute = {
  source: "google",
  traffic: true,
  approximate: false,
  durationSeconds: 300,
  at: new Date(now).toISOString(),
  fromRideId: "current",
  toRideId: "next",
  origin: point,
  destination: pickup,
};
const input = {
  driver,
  currentRide,
  liveRoute,
  nextRide,
  approachRoute,
  hasQueuedRide: false,
  now,
};
describe("enchaînement 3 minutes / 5 minutes", () => {
  it("accepte les limites inclusives de 3 et 5 minutes sans modifier de prix", () => {
    const fare = JSON.stringify(nextRide.fare);
    expect(nextRideEligibility(input)).toEqual({
      currentRideId: "current",
      nextRideId: "next",
      remainingSeconds: 180,
      approachAfterDropoffSeconds: 300,
      estimatedPickupWaitSeconds: 480,
    });
    expect(JSON.stringify(nextRide.fare)).toBe(fare);
  });
  it("refuse au-dessus des deux seuils", () => {
    expect(
      nextRideEligibility({ ...input, liveRoute: { ...liveRoute, durationSeconds: 181 } }),
    ).toBeNull();
    expect(
      nextRideEligibility({ ...input, approachRoute: { ...approachRoute, durationSeconds: 301 } }),
    ).toBeNull();
  });
  it("exige une vraie course en cours et aucune course suivante déjà réservée", () => {
    expect(canReceiveNextRide({ ...input, hasQueuedRide: true })).toBe(false);
    expect(
      nextRideEligibility({ ...input, currentRide: { ...currentRide, status: "accepted" } }),
    ).toBeNull();
    expect(
      nextRideEligibility({ ...input, currentRide: { ...currentRide, driver_id: "other" } }),
    ).toBeNull();
  });
  it("refuse les durées périmées approximatives ou sans trafic", () => {
    for (const changes of [
      { source: "osrm" },
      { approximate: true },
      { traffic: false },
      { at: new Date(now - 45001).toISOString() },
      { durationSeconds: NaN },
    ]) {
      expect(nextRideEligibility({ ...input, liveRoute: { ...liveRoute, ...changes } })).toBeNull();
      expect(
        nextRideEligibility({ ...input, approachRoute: { ...approachRoute, ...changes } }),
      ).toBeNull();
    }
  });
  it("mesure depuis la destination actuelle vers la nouvelle prise en charge", () => {
    expect(
      nextRideEligibility({
        ...input,
        approachRoute: { ...approachRoute, origin: { lat: 40, lng: 2 } },
      }),
    ).toBeNull();
    expect(
      nextRideEligibility({ ...input, approachRoute: { ...approachRoute, destination: point } }),
    ).toBeNull();
    expect(
      nextRideEligibility({ ...input, liveRoute: { ...liveRoute, target: "pickup" } }),
    ).toBeNull();
  });
  it("respecte les catégories les préférences et les refus du chauffeur", () => {
    expect(
      nextRideEligibility({ ...input, nextRide: { ...nextRide, vehicle_type: "xl" } }),
    ).toBeNull();
    expect(
      nextRideEligibility({ ...input, nextRide: { ...nextRide, declined: ["driver"] } }),
    ).toBeNull();
    expect(nextRideEligibility({ ...input, driver: { ...driver, is_online: false } })).toBeNull();
    expect(
      nextRideEligibility({ ...input, nextRide: { ...nextRide, driver_id: "other" } }),
    ).toBeNull();
  });
  it("ne chaîne pas les courses fictives ni une course avec elle-même", () => {
    expect(nextRideEligibility({ ...input, nextRide: { ...nextRide, is_test: true } })).toBeNull();
    expect(nextRideEligibility({ ...input, nextRide: { ...nextRide, id: "current" } })).toBeNull();
  });
});
