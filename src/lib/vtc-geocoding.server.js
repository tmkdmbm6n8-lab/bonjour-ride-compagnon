// Address lookup: Google Maps (managed connector) first, then free backups when Google
// is out of quota or unreachable — French Géoplateforme (BAN) and OpenStreetMap Photon.
export const STRASBOURG_SEARCH_CENTER = { lat: 48.5734, lng: 7.7521 };
export const STRASBOURG_SEARCH_BBOX = [7.2, 48.22, 8.3, 48.93];
const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const BAN = "https://data.geopf.fr/geocodage";
const PHOTON = "https://photon.komoot.io";
const USER_AGENT = "StrasDrive/1.0 (+https://bonjour-ride-compagnon.lovable.app)";

// After a quota error Google is skipped for a while so every keystroke does not burn a call.
const DEFAULT_COOLDOWN_MS = 10 * 60 * 1000;
const MAX_COOLDOWN_MS = 60 * 60 * 1000;
let googlePausedUntil = 0;
export function resetGeocodingCooldown() {
  googlePausedUntil = 0;
}
export function googleGeocodingPaused(now = Date.now()) {
  return now < googlePausedUntil;
}
function pauseGoogle(retryAfterSeconds, now = Date.now()) {
  const asked = Number(retryAfterSeconds) * 1000;
  const ms = Number.isFinite(asked) && asked > 0 ? Math.min(asked, MAX_COOLDOWN_MS) : DEFAULT_COOLDOWN_MS;
  googlePausedUntil = now + ms;
}

class QuotaError extends Error {}

async function googleSearch({ reverse, lat, lng, text }, fetcher) {
  const token = process.env.LOVABLE_API_KEY,
    key = process.env.GOOGLE_MAPS_API_KEY;
  if (!token || !key) throw new Error("La recherche Google Maps n’est pas encore configurée");
  const params = new URLSearchParams({ language: "fr", region: "fr" });
  if (reverse) params.set("latlng", `${lat},${lng}`);
  else {
    params.set("address", text);
    params.set("bounds", "48.22,7.2|48.93,8.3");
  }
  const response = await fetcher(`${GATEWAY}/maps/api/geocode/json?${params}`, {
    headers: { Authorization: `Bearer ${token}`, "X-Connection-Api-Key": key },
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 429) {
    pauseGoogle(response.headers?.get?.("retry-after"));
    throw new QuotaError("Quota Google atteint");
  }
  if (!response.ok) throw new Error(`Google indisponible [${response.status}]`);
  const data = await response.json();
  if (data.status === "ZERO_RESULTS") return [];
  if (data.status === "OVER_QUERY_LIMIT" || data.status === "OVER_DAILY_LIMIT") {
    pauseGoogle();
    throw new QuotaError("Quota Google atteint");
  }
  if (data.status !== "OK") throw new Error(`Google indisponible [${data.status}]`);
  return (data.results || [])
    .filter((r) => Number.isFinite(r.geometry?.location?.lat) && Number.isFinite(r.geometry?.location?.lng))
    .map((r) => ({
      name: r.formatted_address?.split(",")[0] || "Adresse",
      address: r.formatted_address || "Adresse",
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      type: r.types?.[0] || "",
    }));
}

function inBbox(lat, lng) {
  const [w, s, e, n] = STRASBOURG_SEARCH_BBOX;
  return lng >= w && lng <= e && lat >= s && lat <= n;
}

async function banSearch({ reverse, lat, lng, text }, fetcher) {
  const params = new URLSearchParams({ limit: reverse ? "1" : "6" });
  if (reverse) {
    params.set("lat", String(lat));
    params.set("lon", String(lng));
  } else {
    params.set("q", text);
    params.set("lat", String(STRASBOURG_SEARCH_CENTER.lat));
    params.set("lon", String(STRASBOURG_SEARCH_CENTER.lng));
  }
  const response = await fetcher(`${BAN}/${reverse ? "reverse" : "search"}?${params}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`Géoplateforme indisponible [${response.status}]`);
  const data = await response.json();
  return (data.features || [])
    .map((f) => {
      const [fLng, fLat] = f.geometry?.coordinates || [];
      const p = f.properties || {};
      return {
        name: p.name || p.label?.split(" ")[0] || "Adresse",
        address: p.label || p.name || "Adresse",
        lat: Number(fLat),
        lng: Number(fLng),
        type: p.type || "",
      };
    })
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && (reverse || inBbox(r.lat, r.lng)));
}

async function photonSearch({ reverse, lat, lng, text }, fetcher) {
  const params = new URLSearchParams({ lang: "fr", limit: reverse ? "1" : "6" });
  if (reverse) {
    params.set("lat", String(lat));
    params.set("lon", String(lng));
  } else {
    params.set("q", text);
    params.set("bbox", STRASBOURG_SEARCH_BBOX.join(","));
    params.set("lat", String(STRASBOURG_SEARCH_CENTER.lat));
    params.set("lon", String(STRASBOURG_SEARCH_CENTER.lng));
  }
  const response = await fetcher(`${PHOTON}/${reverse ? "reverse" : "api/"}?${params}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`OpenStreetMap indisponible [${response.status}]`);
  const data = await response.json();
  return (data.features || [])
    .map((f) => {
      const [fLng, fLat] = f.geometry?.coordinates || [];
      const p = f.properties || {};
      const street = [p.housenumber, p.street].filter(Boolean).join(" ");
      const name = p.name || street || p.city || "Adresse";
      const address = [name, name === street ? "" : street, [p.postcode, p.city].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");
      return { name, address: address || name, lat: Number(fLat), lng: Number(fLng), type: p.osm_value || p.type || "" };
    })
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

function near(a, b) {
  return Math.abs(a.lat - b.lat) < 0.0003 && Math.abs(a.lng - b.lng) < 0.0004;
}

/** Free backups: French address base first, OpenStreetMap for places and across the border. */
async function backupSearch(query, fetcher) {
  const [ban, photon] = await Promise.allSettled([banSearch(query, fetcher), photonSearch(query, fetcher)]);
  if (ban.status === "rejected" && photon.status === "rejected") {
    throw new Error("Aucun service d’adresses disponible");
  }
  const a = ban.status === "fulfilled" ? ban.value : [],
    b = photon.status === "fulfilled" ? photon.value : [];
  // Alternate street addresses (BAN) and places like stations or the airport (OSM).
  const merged = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    for (const r of [a[i], b[i]]) if (r && !merged.some((m) => near(m, r))) merged.push(r);
  }
  return merged;
}

export async function geoSearch(q, fetcher = fetch, provider = "auto") {
  const reverse = q.get("reverse") === "1";
  const lat = Number.parseFloat(q.get("lat")),
    lng = Number.parseFloat(q.get("lng"));
  const text = (q.get("q") || "").trim().slice(0, 200);
  if (
    reverse &&
    (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
  ) {
    throw new Error("Latitude et longitude requises");
  }
  if (!reverse && text.length < 2) return { results: [] };
  const query = { reverse, lat, lng, text };
  const limit = reverse ? 1 : 6;

  if (provider === "osm") {
    try { return { results: (await backupSearch(query, fetcher)).slice(0, limit), provider: "osm" }; }
    catch (error) { console.error("[geo] OSM indisponible:", error?.message || error); throw new Error("La recherche OpenStreetMap est momentanément indisponible"); }
  }
  if (!googleGeocodingPaused()) {
    try {
      return { results: (await googleSearch(query, fetcher)).slice(0, limit), provider: "google" };
    } catch (error) {
      console.warn("[geo] Google indisponible, bascule sur le secours:", error?.message || error);
    }
  }
  if (provider === "google") throw new Error("Google Places est indisponible ou son quota est atteint. Sélectionnez OSM dans les réglages.");
  try {
    return { results: (await backupSearch(query, fetcher)).slice(0, limit), backup: true, provider: "osm" };
  } catch (error) {
    console.error("[geo] Secours indisponible:", error?.message || error);
    throw new Error("La recherche d’adresse est momentanément indisponible");
  }
}
