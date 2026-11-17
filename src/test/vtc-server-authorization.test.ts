// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  role: "rider",
  ride: null as Record<string, unknown> | null,
  online: false,
  writes: [] as unknown[],
  reads: [] as string[],
  messages: [] as unknown[],
  filters: [] as { table: string; key: string; value: unknown }[],
}));
function query(table: string, admin = false) {
  const data = () =>
    table === "user_roles"
      ? [{ role: fake.role }]
      : table === "profiles"
        ? { id: "self", name: "Self", balance: 100 }
        : table === "drivers"
          ? { user_id: "self", is_online: fake.online }
          : table === "rides"
            ? fake.ride
            : table === "contact_messages"
              ? fake.messages
              : [];
  let single = false,
    mutation = false;
  const q: Record<string, unknown> = {
    select() {
      return q;
    },
    eq(key: string, value: unknown) {
      fake.filters.push({ table, key, value });
      return q;
    },
    in() {
      return q;
    },
    limit() {
      return q;
    },
    order() {
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
    insert(value: unknown) {
      mutation = true;
      fake.writes.push({ table, value });
      if (table === "contact_messages") fake.messages.push(value);
      return q;
    },
    update(value: unknown) {
      mutation = true;
      fake.writes.push({ table, value });
      return q;
    },
    then(resolve: (value: unknown) => unknown) {
      if (!mutation) fake.reads.push(`${admin ? "admin" : "user"}:${table}`);
      const value = data();
      return Promise.resolve({
        data: single ? value : Array.isArray(value) ? value : value ? [value] : [],
        error: null,
      }).then(resolve);
    },
  };
  return q;
}
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table: string) => query(table, true) },
}));
import { handleVtc } from "@/lib/vtc.server";
const context = () => ({
  userId: "self",
  claims: { email: "self@example.test" },
  supabase: { from: (table: string) => query(table) },
});
beforeEach(() => {
  fake.role = "rider";
  fake.ride = { id: "private", rider_id: "other", driver_id: "different", status: "accepted" };
  fake.online = false;
  fake.writes = [];
  fake.reads = [];
  fake.messages = [];
  fake.filters = [];
});
describe("autorisations réelles du gestionnaire serveur", () => {
  it("refuse un client dans les fonctions administrateur avant toute écriture", async () => {
    await expect(
      handleVtc({ path: "/api/admin/users", method: "DELETE", body: {} }, context()),
    ).rejects.toThrow(/administrateur/);
    expect(fake.writes).toEqual([]);
    expect(fake.reads.some((x) => x.startsWith("admin:"))).toBe(false);
  });
  it("refuse la course d’un autre client", async () => {
    await expect(handleVtc({ path: "/api/rides/private" }, context())).rejects.toThrow(
      /inaccessible/,
    );
    expect(fake.writes).toEqual([]);
  });
  it("refuse une mutation en GET sans lire ni modifier la course", async () => {
    await expect(handleVtc({ path: "/api/rides/private/complete" }, context())).rejects.toThrow(
      /Méthode/,
    );
    expect(fake.reads).not.toContain("admin:rides");
    expect(fake.writes).toEqual([]);
  });
  it("refuse un document déposé dans le dossier d’un autre chauffeur", async () => {
    fake.role = "driver";
    await expect(
      handleVtc(
        {
          path: "/api/drivers/me/documents",
          method: "POST",
          body: { type: "identity", date: "2030-01-01", path: "other/identity.pdf" },
        },
        context(),
      ),
    ).rejects.toThrow(/Fichier invalide/);
    expect(fake.writes).toEqual([]);
  });
  it("ignore une position reçue hors ligne et sans course", async () => {
    fake.role = "driver";
    fake.ride = null;
    expect(
      await handleVtc(
        { path: "/api/drivers/location", method: "POST", body: { lat: 48, lng: 7 } },
        context(),
      ),
    ).toMatchObject({ ignored: true });
    expect(fake.writes).toEqual([]);
  });
  it("efface la position au passage hors ligne", async () => {
    fake.role = "driver";
    fake.ride = null;
    fake.online = true;
    await handleVtc(
      { path: "/api/drivers/me/status", method: "POST", body: { online: false } },
      context(),
    );
    expect(fake.writes).toContainEqual({
      table: "drivers",
      value: expect.objectContaining({ is_online: false, location: null }),
    });
  });
  it("enregistre la demande de facture du participant sans toucher au prix", async () => {
    fake.ride = {
      id: "private",
      rider_id: "self",
      driver_id: "different",
      status: "completed",
      fare: { total: 42 },
    };
    await handleVtc({ path: "/api/rides/private/invoice", method: "POST" }, context());
    expect(fake.writes).toEqual([
      {
        table: "contact_messages",
        value: expect.objectContaining({ email: "self@example.test", topic: "payments" }),
      },
    ]);
    expect(fake.ride.fare).toEqual({ total: 42 });
  });
  it("suit la course passager d’un chauffeur sur l’écran passager", async () => {
    fake.role = "driver";
    fake.ride = null;
    await handleVtc({ path: "/api/rides/active?view=rider" }, context());
    expect(fake.filters).toContainEqual({ table: "rides", key: "rider_id", value: "self" });
    expect(fake.filters).not.toContainEqual({ table: "rides", key: "driver_id", value: "self" });
  });
  it("permet le suivi passager à un administrateur sans ouvrir les courses d’autres clients", async () => {
    fake.role = "admin";
    fake.ride = null;
    await handleVtc({ path: "/api/rides/active?view=rider" }, context());
    expect(fake.filters).toContainEqual({ table: "rides", key: "rider_id", value: "self" });
  });
});
