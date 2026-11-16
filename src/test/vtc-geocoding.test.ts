import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geoSearch } from "@/lib/vtc-geocoding.server.js";

beforeEach(() => {
  vi.stubEnv("LOVABLE_API_KEY", "test-connector");
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-server-key");
});
afterEach(() => vi.unstubAllEnvs());
const result = {
  formatted_address: "Place de la Gare, Strasbourg",
  geometry: { location: { lat: 48.58, lng: 7.73 } },
  types: ["street_address"],
};

describe("recherche Google Maps", () => {
  it("utilise le connecteur serveur sans transmettre les secrets dans l’URL", async () => {
    const fetcher = vi.fn(async () => Response.json({ status: "OK", results: [result] }));
    const out = await geoSearch(new URLSearchParams({ q: "gare" }), fetcher);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("connector-gateway.lovable.dev/google_maps/maps/api/geocode/json");
    expect(url).not.toContain("test-server-key");
    expect(options.headers).toMatchObject({ "X-Connection-Api-Key": "test-server-key" });
    expect(out.results[0]).toMatchObject({
      address: result.formatted_address,
      lat: 48.58,
      lng: 7.73,
    });
  });
  it("convertit les coordonnées GPS en adresse", async () => {
    const fetcher = vi.fn(async () => Response.json({ status: "OK", results: [result] }));
    await geoSearch(new URLSearchParams({ reverse: "1", lat: "48.58", lng: "7.73" }), fetcher);
    expect(fetcher.mock.calls[0][0]).toContain("latlng=48.58%2C7.73");
  });
  it("accepte une recherche sans résultat", async () => {
    expect(
      await geoSearch(new URLSearchParams({ q: "inconnu" }), async () =>
        Response.json({ status: "ZERO_RESULTS" }),
      ),
    ).toEqual({ results: [] });
  });
  it("signale les erreurs Google sans basculer sur un autre fournisseur", async () => {
    const fetcher = vi.fn(async () => Response.json({ status: "REQUEST_DENIED" }));
    await expect(geoSearch(new URLSearchParams({ q: "gare" }), fetcher)).rejects.toThrow(
      /indisponible/,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("valide les coordonnées avant tout appel", async () => {
    const fetcher = vi.fn();
    await expect(
      geoSearch(new URLSearchParams({ reverse: "1", lat: "91", lng: "7" }), fetcher),
    ).rejects.toThrow(/Latitude/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("indique une configuration manquante", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
    await expect(geoSearch(new URLSearchParams({ q: "gare" }))).rejects.toThrow(/configurée/);
  });
});
