import { describe, it, expect } from "vitest";
import { handleDynamicSettings, loadDynamicSettings } from "@/lib/dynamic-pricing.server";
import { defaultDynamicConfig } from "@/lib/dynamic-pricing";
function database(initial: any = null) {
  let stored = initial,
    stale = false,
    fail = false;
  const writes: any[] = [];
  return {
    get stored() {
      return stored;
    },
    writes,
    setStale() {
      stale = true;
    },
    setFail() {
      fail = true;
    },
    from(table: string) {
      expect(table).toBe("pricing_rules");
      let write: any = null,
        insert = false;
      const filters: any[] = [];
      const q: any = {
        select() {
          return q;
        },
        eq(k: string, v: any) {
          filters.push([k, v]);
          return q;
        },
        maybeSingle: async () => ({
          data: stored ? { rule: stored } : null,
          error: fail ? { message: "offline" } : null,
        }),
        update(v: any) {
          write = v;
          return q;
        },
        insert(v: any) {
          write = v;
          insert = true;
          return q;
        },
        then(resolve: any) {
          if (fail)
            return Promise.resolve({ data: null, error: { message: "offline" } }).then(resolve);
          if (stale)
            return Promise.resolve({ data: [], error: insert ? { code: "23505" } : null }).then(
              resolve,
            );
          expect(write.is_active).toBe(false);
          if (!insert) expect(filters).toContainEqual(["rule", JSON.stringify(stored)]);
          writes.push(write);
          stored = write.rule;
          return Promise.resolve({ data: [{ vehicle_type: "dynamic_pricing" }], error: null }).then(
            resolve,
          );
        },
      };
      return q;
    },
  };
}
describe("paramètres dynamiques persistants et concurrence", () => {
  it("enregistre puis relit les créneaux, zones et surcharges", async () => {
    const db = database();
    const config = defaultDynamicConfig();
    config.levels[0].byCategory = { xl: 20 };
    config.zones[0].schedule[0][12] = "high";
    await handleDynamicSettings(db, { method: "PUT", body: { config, expectedRevision: 0 } });
    expect((await handleDynamicSettings(db, { method: "GET" })).config).toMatchObject({
      revision: 1,
      levels: expect.arrayContaining([expect.objectContaining({ byCategory: { xl: 20 } })]),
    });
    expect((await loadDynamicSettings(db))?.zones[0].schedule[0][12]).toBe("high");
  });
  it("active et désactive immédiatement sans écraser les autres paramètres", async () => {
    const db = database(defaultDynamicConfig());
    await handleDynamicSettings(db, {
      method: "PATCH",
      body: { enabled: true, expectedRevision: 0 },
    });
    expect(db.stored.enabled).toBe(true);
    await handleDynamicSettings(db, {
      method: "PATCH",
      body: { enabled: false, expectedRevision: 1 },
    });
    expect(db.stored.revision).toBe(2);
    expect(db.stored.zones).toEqual(defaultDynamicConfig().zones);
  });
  it("refuse une révision périmée avant toute écriture", async () => {
    const db = database();
    await expect(
      handleDynamicSettings(db, { method: "PATCH", body: { enabled: true, expectedRevision: 3 } }),
    ).rejects.toThrow(/ailleurs/);
    expect(db.writes).toEqual([]);
  });
  it.each([null, defaultDynamicConfig()])(
    "refuse aussi une écriture concurrente après lecture",
    async (initial) => {
      const db = database(initial);
      db.setStale();
      await expect(
        handleDynamicSettings(db, {
          method: "PUT",
          body: { config: defaultDynamicConfig(), expectedRevision: 0 },
        }),
      ).rejects.toThrow(/ailleurs/);
    },
  );
  it("revient au barème si lecture impossible ou configuration corrompue", async () => {
    const db = database();
    db.setFail();
    expect(await loadDynamicSettings(db)).toBe(null);
    expect(await loadDynamicSettings(database({ invalid: true }))).toBe(null);
  });
  it("rejette les valeurs non valides sans écrire", async () => {
    const db = database();
    const c = defaultDynamicConfig();
    c.levels[0].percent = NaN;
    await expect(
      handleDynamicSettings(db, { method: "PUT", body: { config: c, expectedRevision: 0 } }),
    ).rejects.toThrow();
    expect(db.writes).toEqual([]);
  });
});
