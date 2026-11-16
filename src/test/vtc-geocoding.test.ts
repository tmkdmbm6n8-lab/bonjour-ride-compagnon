import { describe, it, expect } from "vitest";
import { geoSearch } from "@/lib/vtc-geocoding.server.js";

const feature = (name: string) => ({
  geometry: { coordinates: [7.73, 48.58] },
  properties: { name, label: `${name} 67000 Strasbourg` },
});
const ok = (features: unknown[]) => new Response(JSON.stringify({ features }), { status: 200 });

describe("recherche d'adresse", () => {
  it("utilise la Géoplateforme quand Photon ne répond pas", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      if (url.includes("photon")) throw new Error("timeout");
      return ok([feature("Place de la Gare")]);
    };
    const out = await geoSearch(new URLSearchParams({ q: "gare" }), fetcher as typeof fetch);
    expect(out.results[0].name).toBe("Place de la Gare");
    expect(calls.some((u) => u.includes("data.geopf.fr"))).toBe(true);
  });

  it("garde Photon quand il répond", async () => {
    const fetcher = async (url: string) => (url.includes("photon") ? ok([feature("Gare Centrale")]) : ok([]));
    const out = await geoSearch(new URLSearchParams({ q: "gare" }), fetcher as typeof fetch);
    expect(out.results[0].name).toBe("Gare Centrale");
  });

  it("signale l'indisponibilité seulement si les deux services échouent", async () => {
    const fetcher = async () => new Response("", { status: 503 });
    await expect(geoSearch(new URLSearchParams({ q: "gare" }), fetcher as typeof fetch)).rejects.toThrow(/indisponible/);
  });
});
