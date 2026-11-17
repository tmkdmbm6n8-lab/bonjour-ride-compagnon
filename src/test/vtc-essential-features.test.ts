import { describe, expect, it, vi } from "vitest";
import { requestAccountEmail, validateNewPassword } from "@/lib/account-recovery";
import { receiptHtml, shareRideText } from "@/lib/ride-documents";

const ride = {
  id: "ride-1",
  status: "completed",
  createdAt: "2026-11-16T12:00:00Z",
  pickup: { address: "<script>alert(1)</script>" },
  dropoff: { address: "Gare" },
  fare: { total: 25 },
  payment: { method: "cash" },
  pin: "1234",
  driver: { name: "Chauffeur", phone: "0600000000", vehicle: { plate: "AA-123-BB" } },
};
describe("récupération de compte", () => {
  it("utilise le flux existant de récupération avec une URL locale connue", async () => {
    const auth = {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      resend: vi.fn(),
    };
    await requestAccountEmail(
      auth,
      " CLIENT@example.com ",
      "password",
      "https://strasdrive.example",
    );
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("client@example.com", {
      redirectTo: "https://strasdrive.example/recover-account",
    });
    expect(auth.resend).not.toHaveBeenCalled();
  });
  it("renvoie la confirmation d’inscription sans créer de compte", async () => {
    const auth = {
      resetPasswordForEmail: vi.fn(),
      resend: vi.fn().mockResolvedValue({ error: null }),
    };
    await requestAccountEmail(
      auth,
      "client@example.com",
      "confirmation",
      "https://strasdrive.example",
    );
    expect(auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "client@example.com",
      options: { emailRedirectTo: "https://strasdrive.example/login" },
    });
  });
  it("ne révèle pas les erreurs sensibles du fournisseur", async () => {
    const auth = {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: { message: "user not found" } }),
    };
    await expect(
      requestAccountEmail(auth, "client@example.com", "password", "https://example.com"),
    ).rejects.toThrow("momentanément indisponible");
  });
  it("refuse un mot de passe trop court ou une confirmation différente", () => {
    expect(validateNewPassword("123", "123")).not.toBe("");
    expect(validateNewPassword("password1", "password2")).not.toBe("");
    expect(validateNewPassword("password1", "password1")).toBe("");
  });
});
describe("reçus et résumé partagé", () => {
  it("échappe les champs de la course dans le document téléchargeable", () => {
    const html = receiptHtml(ride);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("25");
    expect(html).toContain("ne certifie pas l’encaissement");
    expect(html).not.toContain(ride.pin);
  });
  it("ne produit pas de reçu pour un trajet non terminé ou fictif", () => {
    expect(() => receiptHtml({ ...ride, status: "accepted" })).toThrow();
    expect(() => receiptHtml({ ...ride, isTest: true })).toThrow();
  });
  it("limite un reçu d’annulation aux frais d’annulation", () => {
    const html = receiptHtml({
      ...ride,
      status: "cancelled",
      fare: { total: 25, cancellationFee: 5 },
    });
    expect(html).toContain("5,00");
    expect(html).not.toContain("25,00");
  });
  it("partage les informations utiles sans PIN ni téléphone personnel", () => {
    const text = shareRideText(ride);
    expect(text).toContain("AA-123-BB");
    expect(text).not.toContain(ride.pin);
    expect(text).not.toContain(ride.driver.phone);
    expect(text).toContain("sans suivi en direct");
  });
});
