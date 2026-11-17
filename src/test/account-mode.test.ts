// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import { accountView, rideOwnerColumn } from "@/lib/account-mode";
import { preparePassengerBooking, switchAccountMode } from "@/lib/vtc-account-mode.server";
import { availableFor, canSeeOffer } from "@/lib/vtc-dispatch";
import { newlyOfferedDriverIds } from "@/lib/vtc-push";
function db({ driving = false, travelling = false, offlineError = false } = {}) {
  const update = vi.fn();
  return {
    update,
    from: (table: string) => {
      let field = "";
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (key: string) => {
          field = key;
          return q;
        },
        in: () => q,
        limit: () => q,
        update: (data: unknown) => {
          update(data);
          return q;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data:
              table === "rides"
                ? (field === "driver_id" ? driving : travelling)
                  ? [{ id: "active" }]
                  : []
                : [],
            error: table === "drivers" && offlineError ? { message: "failed" } : null,
          }).then(resolve),
      };
      return q;
    },
  };
}
describe("bascule d’affichage sans changement de rôle", () => {
  it("distingue les espaces et impose le filtre propriétaire correct", () => {
    expect(accountView("/dashboard")).toBe("rider");
    expect(accountView("/driver/menu")).toBe("driver");
    expect(accountView("/admin/dashboard")).toBe("admin");
    expect(rideOwnerColumn("driver", "rider")).toBe("rider_id");
    expect(rideOwnerColumn("admin", "rider", false)).toBe("rider_id");
    expect(() => rideOwnerColumn("rider", "driver", false)).toThrow();
  });
  it("met le chauffeur hors ligne avant une réservation passager sans toucher aux montants", async () => {
    const store = db();
    await preparePassengerBooking(store, "self", true);
    expect(store.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_online: false, location: null }),
    );
  });
  it("ne permet pas de quitter une course chauffeur active pour réserver", async () => {
    const store = db({ driving: true });
    await expect(preparePassengerBooking(store, "self", true)).rejects.toThrow(/course chauffeur/);
    expect(store.update).not.toHaveBeenCalled();
  });
  it("interdit de reprendre le travail pendant une course passager", async () => {
    await expect(
      switchAccountMode(db({ travelling: true }), { uid: "self", canDrive: true, mode: "driver" }),
    ).rejects.toThrow(/course passager/);
  });
  it("autorise le retour au suivi passager existant sans remise en ligne automatique", async () => {
    const store = db({ travelling: true });
    expect(await switchAccountMode(store, { uid: "self", canDrive: true, mode: "rider" })).toEqual({
      mode: "rider",
    });
    const free = db();
    await switchAccountMode(free, { uid: "self", canDrive: true, mode: "driver" });
    expect(free.update).not.toHaveBeenCalled();
  });
  it("autorise les comptes administrateur à réserver comme passager sans leur créer de rôle chauffeur", async () => {
    const store = db();
    await preparePassengerBooking(store, "admin", false);
    expect(store.update).not.toHaveBeenCalled();
    await expect(
      switchAccountMode(store, { uid: "admin", canDrive: false, mode: "driver" }),
    ).rejects.toThrow(/chauffeur/);
  });
  it("bloque une réservation si la mise hors ligne échoue", async () => {
    await expect(preparePassengerBooking(db({ offlineError: true }), "self", true)).rejects.toThrow(
      /hors ligne/,
    );
  });
});
describe("aucune offre de sa propre commande", () => {
  const now = Date.parse("2026-11-17T12:00:00Z");
  const driver = {
    user_id: "self",
    is_priority: true,
    location: { lat: 48.57, lng: 7.75 },
    vehicle_class: "economy",
    accepts_classes: ["economy"],
  };
  const ride = {
    id: "ride",
    rider_id: "self",
    status: "searching",
    vehicle_type: "economy",
    pickup: { lat: 48.57, lng: 7.75 },
    dispatch_phase: "priority",
    offer_expires_at: new Date(now + 15000).toISOString(),
    payment: { method: "wallet" },
    fare: { driverEarnings: 20 },
    route: { distanceMeters: 5000 },
  };
  it("exclut le chauffeur même prioritaire de l’offre et de sa notification", () => {
    expect(availableFor(ride, [driver])).toEqual([]);
    expect(canSeeOffer(ride, driver, now, [driver])).toBe(false);
    expect(newlyOfferedDriverIds(null, ride, [driver], now)).toEqual([]);
  });
});
