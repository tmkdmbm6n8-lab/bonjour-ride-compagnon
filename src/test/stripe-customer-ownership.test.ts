import { describe, expect, it, vi } from "vitest";
import { resolveOrCreateCustomer } from "@/lib/vtc-checkout.server";
describe("identité des comptes de paiement sans modification tarifaire", () => {
  function stripe(owner?: string) {
    return {
      customers: {
        search: vi.fn().mockResolvedValue({ data: [] }),
        list: vi
          .fn()
          .mockResolvedValue({ data: [{ id: "old", metadata: owner ? { userId: owner } : {} }] }),
        update: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: "new" }),
      },
    };
  }
  it("ne réattribue jamais un compte de paiement appartenant à un autre utilisateur", async () => {
    const client = stripe("other");
    expect(
      await resolveOrCreateCustomer(client, { userId: "self", email: "same@example.test" }),
    ).toBe("new");
    expect(client.customers.update).not.toHaveBeenCalled();
    expect(client.customers.create).toHaveBeenCalledWith({
      email: "same@example.test",
      metadata: { userId: "self" },
    });
  });
  it("ne récupère pas automatiquement un compte non rattaché sur la seule adresse e-mail", async () => {
    const client = stripe();
    expect(
      await resolveOrCreateCustomer(client, { userId: "self", email: "same@example.test" }),
    ).toBe("new");
  });
  it("réutilise le compte dont l’appartenance est déjà établie", async () => {
    const client = stripe("self");
    expect(
      await resolveOrCreateCustomer(client, { userId: "self", email: "same@example.test" }),
    ).toBe("old");
    expect(client.customers.create).not.toHaveBeenCalled();
  });
});
