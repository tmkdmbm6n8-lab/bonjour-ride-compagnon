// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geoSearch, googleGeocodingPaused, resetGeocodingCooldown } from "@/lib/vtc-geocoding.server.js";

beforeEach(() => {
  vi.stubEnv("LOVABLE_API_KEY", "test-connector");
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-server-key");
  resetGeocodingCooldown();
});
afterEach(() => vi.unstubAllEnvs());
const result = {
  formatted_address: "Place de la Gare, Strasbourg",
  geometry: { location: { lat: 48.58, lng: 7.73 } },
  types: ["street_address"],
};
const banFeature = {
  geometry: { coordinates: [7.7356, 48.5844] },
  properties: { label: "Place de la Gare 67000 Strasbourg", name: "Place de la Gare", type: "street" },
};
const photonFeature = {
  geometry: { coordinates: [7.8073, 48.5749] },
  properties: { name: "Kehl Bahnhof", street: "Hauptstraße", postcode: "77694", city: "Kehl", osm_value: "station" },
};

/** Google answers `google`, the backups answer with one feature each. */
function fakeNetwork(google: () => Response) {
  return vi.fn(async (url: string) => {
    if (url.includes("connector-gateway")) return google();
    if (url.includes("data.geopf.fr")) return Response.json({ features: [banFeature] });
    if (url.includes("photon.komoot.io")) return Response.json({ features: [photonFeature] });
    throw new Error("unexpected " + url);
  });
}

describe("recherche d’adresses", () => {
  it("utilise Google en premier, sans secrets dans l’URL", async () => {
    const fetcher = fakeNetwork(() => Response.json({ status: "OK", results: [result] }));
    const out = await geoSearch(new URLSearchParams({ q: "gare" }), fetcher);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("connector-gateway.lovable.dev/google_maps/maps/api/geocode/json");
    expect(url).not.toContain("test-server-key");
    expect(options.headers).toMatchObject({ "X-Connection-Api-Key": "test-server-key" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(out.results[0]).toMatchObject({ address: result.formatted_address, lat: 48.58, lng: 7.73 });
  });
  it("convertit les coordonnées GPS en adresse", async () => {
    const fetcher = fakeNetwork(() => Response.json({ status: "OK", results: [result] }));
    await geoSearch(new URLSearchParams({ reverse: "1", lat: "48.58", lng: "7.73" }), fetcher);
    expect(fetcher.mock.calls[0][0]).toContain("latlng=48.58%2C7.73");
  });
  it("accepte une recherche sans résultat Google", async () => {
    const fetcher = fakeNetwork(() => Response.json({ status: "ZERO_RESULTS" }));
    expect(await geoSearch(new URLSearchParams({ q: "inconnu" }), fetcher)).toEqual({ results: [] });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("bascule sur les secours quand le quota Google est épuisé (429)", async () => {
    const fetcher = fakeNetwork(() => new Response("Rate limit exceeded", { status: 429 }));
    const out = await geoSearch(new URLSearchParams({ q: "gare" }), fetcher);
    expect(out.backup).toBe(true);
    expect(out.results.map((r) => r.address)).toEqual([
      "Place de la Gare 67000 Strasbourg",
      "Kehl Bahnhof, Hauptstraße, 77694 Kehl",
    ]);
    expect(googleGeocodingPaused()).toBe(true);
  });
  it("n’appelle plus Google pendant la pause après un quota épuisé", async () => {
    const fetcher = fakeNetwork(() => new Response("", { status: 429 }));
    await geoSearch(new URLSearchParams({ q: "gare" }), fetcher);
    fetcher.mockClear();
    await geoSearch(new URLSearchParams({ q: "gare centrale" }), fetcher);
    expect(fetcher.mock.calls.some(([u]) => String(u).includes("connector-gateway"))).toBe(false);
  });
  it("bascule aussi sur OVER_QUERY_LIMIT et les erreurs Google", async () => {
    for (const status of ["OVER_QUERY_LIMIT", "REQUEST_DENIED"]) {
      resetGeocodingCooldown();
      const fetcher = fakeNetwork(() => Response.json({ status }));
      const out = await geoSearch(new URLSearchParams({ q: "gare" }), fetcher);
      expect(out.backup).toBe(true);
      expect(out.results.length).toBe(2);
    }
  });
  it("utilise le secours si Google n’est pas configuré", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
    const out = await geoSearch(new URLSearchParams({ q: "gare" }), fakeNetwork(() => Response.json({})));
    expect(out.backup).toBe(true);
  });
  it("garde un seul résultat en recherche inverse", async () => {
    const fetcher = fakeNetwork(() => new Response("", { status: 429 }));
    const out = await geoSearch(new URLSearchParams({ reverse: "1", lat: "48.58", lng: "7.73" }), fetcher);
    expect(out.results).toHaveLength(1);
  });
  it("signale une erreur si Google et tous les secours sont indisponibles", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 503 }));
    await expect(geoSearch(new URLSearchParams({ q: "gare" }), fetcher)).rejects.toThrow(/indisponible/);
  });
  it("valide les coordonnées avant tout appel", async () => {
    const fetcher = vi.fn();
    await expect(
      geoSearch(new URLSearchParams({ reverse: "1", lat: "91", lng: "7" }), fetcher),
    ).rejects.toThrow(/Latitude/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
