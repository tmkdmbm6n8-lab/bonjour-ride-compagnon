import { describe, expect, it, vi } from "vitest";
import { favoriteLiveLocation } from "@/lib/private-clients.server";

const now = Date.parse("2026-11-25T10:00:00Z");
type TestDriver = {
  is_online: boolean;
  is_approved: boolean;
  location: { lat: number; lng: number; heading: number; observedAt: string | undefined };
};
const live: TestDriver = {
  is_online: true,
  is_approved: true,
  location: { lat: 48.581234, lng: 7.751678, heading: 42, observedAt: new Date(now - 2000).toISOString() },
};

function database({ linked = true, blocked = false, driver = live } = {}) {
  const linkEq = vi.fn(() => ({ maybeSingle: async () => ({ data: linked ? { driver_id: "driver" } : null }) }));
  const driverEq = vi.fn(() => ({ maybeSingle: async () => ({ data: driver }) }));
  return {
    linkEq,
    driverEq,
    from: vi.fn((table: string) => {
      if (table === "rider_favorite_drivers") return { select: () => ({ eq: linkEq }) };
      if (table === "drivers") return { select: () => ({ eq: driverEq }) };
      if (table === "user_blocks") return { select: () => ({ or: () => ({
        limit: async () => ({ data: blocked ? [{ blocker_id: "driver" }] : [] }),
      }) }) };
      throw new Error("Unexpected table");
    }),
  };
}

describe("position du chauffeur favori", () => {
  it("ne renvoie qu’une position approximative pour le favori du passager connecté", async () => {
    const db = database();
    expect(await favoriteLiveLocation(db, "rider", now)).toEqual({
      status: "online",
      driverId: "driver",
      position: { lat: 48.581, lng: 7.752 },
      expiresInMs: 33000,
    });
    expect(db.linkEq).toHaveBeenCalledWith("rider_id", "rider");
    expect(db.driverEq).toHaveBeenCalledWith("user_id", "driver");
  });

  it.each([{ linked: false }, { blocked: true }])("ne lit aucune position si la relation ne permet pas le partage", async (options) => {
    const db = database(options);
    expect(await favoriteLiveLocation(db, "rider", now)).toEqual({ status: "unavailable" });
    expect(db.driverEq).not.toHaveBeenCalled();
  });

  it.each([
    { is_online: false },
    { is_approved: false },
  ])("masque la position en dehors du statut autorisé", async (patch) => {
    expect(await favoriteLiveLocation(database({ driver: { ...live, ...patch } }), "rider", now))
      .toEqual({ status: "offline", driverId: "driver" });
  });

  it.each([undefined, new Date(now - 35000).toISOString()])("ignore les positions sans date ou périmées", async (observedAt) => {
    const driver = { ...live, location: { ...live.location, observedAt } };
    expect(await favoriteLiveLocation(database({ driver }), "rider", now))
      .toEqual({ status: "waiting", driverId: "driver" });
  });
});
