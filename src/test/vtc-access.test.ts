import { describe, expect, it } from "vitest";
import {
  assertRideActionMethod,
  privateDocumentPath,
  validLocation,
  invoiceRequestMessage,
} from "@/lib/vtc-access";

describe("accès et méthodes de course", () => {
  it.each(["accept", "decline", "arrive", "start", "complete", "cancel", "rate", "invoice"])(
    "refuse une mutation %s en GET",
    (action) => {
      expect(() => assertRideActionMethod(action, "GET")).toThrow(/Méthode/);
      expect(() => assertRideActionMethod(action, "POST")).not.toThrow();
    },
  );
  it("autorise uniquement les lectures nécessaires", () => {
    expect(() => assertRideActionMethod("route", "GET")).not.toThrow();
    expect(() => assertRideActionMethod("messages", "GET")).not.toThrow();
    expect(() => assertRideActionMethod("messages", "POST")).not.toThrow();
    expect(() => assertRideActionMethod("radars", "POST")).toThrow();
  });
  it("contrôle le propriétaire et le dossier plat des fichiers", () => {
    expect(privateDocumentPath("alice/vtc_card-123.pdf", "alice")).toBe(true);
    for (const path of [
      "bob/vtc_card.pdf",
      "alice/../bob/test.pdf",
      "alice/%2e%2e/test.pdf",
      "alice/dir/test.pdf",
      "alice/test.pdf?token=x",
      "alice/test.html",
    ])
      expect(privateDocumentPath(path, "alice")).toBe(false);
  });
  it("rejette les positions GPS non valides sans changer les calculs de trajet", () => {
    expect(validLocation({ lat: 48, lng: 7 })).toBe(true);
    expect(validLocation({ lat: 91, lng: 7 })).toBe(false);
    expect(validLocation({ lat: 48, lng: Infinity })).toBe(false);
  });
});
describe("demande authentifiée de facture", () => {
  const ride = {
    id: "ride",
    rider_id: "rider",
    driver_id: "driver",
    status: "completed",
    fare: { total: 30 },
  };
  it("ne permet pas de demander la facture d’une autre personne", () => {
    expect(() => invoiceRequestMessage(ride, "intruder", "rider")).toThrow(/inaccessible/);
    expect(invoiceRequestMessage(ride, "rider", "rider")).toContain("course ride");
  });
  it("ne fait pas passer une demande pour une facture émise", () => {
    expect(invoiceRequestMessage(ride, "driver", "driver")).toContain("Ne pas confondre");
    expect(() => invoiceRequestMessage({ ...ride, is_test: true }, "rider", "rider")).toThrow();
    expect(() =>
      invoiceRequestMessage({ ...ride, status: "accepted" }, "rider", "rider"),
    ).toThrow();
  });
});
