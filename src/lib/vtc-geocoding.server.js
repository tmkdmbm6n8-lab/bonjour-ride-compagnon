import { wazeSearch } from "./vtc-waze.server";
// Photon stays keyless. Search Strasbourg and its surroundings before widening.
const PHOTON_BASE = "https://photon.komoot.io";
export const STRASBOURG_SEARCH_CENTER = { lat: 48.5734, lng: 7.7521 };
export const STRASBOURG_SEARCH_BBOX = [7.2, 48.22, 8.3, 48.93];

function localPoint(lat, lng) {
  const [west, south, east, north] = STRASBOURG_SEARCH_BBOX;
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= south && lat <= north && lng >= west && lng <= east;
}

// French national address service (Géoplateforme, keyless): fallback when Photon is slow or refuses the server.
const GEOPF_BASE = "https://data.geopf.fr/geocodage";

const hasPoint = (f) =>
  Array.isArray(f?.geometry?.coordinates) &&
  Number.isFinite(f.geometry.coordinates[0]) &&
  Number.isFinite(f.geometry.coordinates[1]);

function fromPhoton(f) {
  const x = f.properties || {};
  const parts = [x.name, x.street, x.housenumber, x.district, x.city, x.state, x.country]
    .filter(Boolean)
    .filter((v, i, all) => all.indexOf(v) === i);
  return {
    name: x.name || x.street || "Lieu inconnu",
    address: parts.join(", "),
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    type: x.osm_value || x.type || "",
  };
}

function fromGeopf(f) {
  const x = f.properties || {};
  return {
    name: x.name || x.label || "Lieu inconnu",
    address: [x.label, x.context].filter(Boolean).join(", "),
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    type: x.type || "",
  };
}

export async function geoSearch(q, fetcher = fetch) {
  const reverse = q.get("reverse") === "1";
  const lat = parseFloat(q.get("lat")),
    lng = parseFloat(q.get("lng"));
  const text = (q.get("q") || "").trim();

  // Returns the features, or null when the service did not answer properly.
  async function request(url, timeout) {
    try {
      const res = await fetcher(url, {
        signal: AbortSignal.timeout(timeout),
        headers: { "User-Agent": "strasdrive/1.0 (contact via app)", Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.features || []).filter(hasPoint);
    } catch {
      return null;
    }
  }

  if (reverse) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Latitude et longitude requises");
    const photon = await request(`${PHOTON_BASE}/reverse?lon=${lng}&lat=${lat}&limit=1&lang=fr`, 3500);
    if (photon?.length) return { results: photon.map(fromPhoton) };
    const geopf = await request(`${GEOPF_BASE}/reverse?lon=${lng}&lat=${lat}&limit=1`, 4000);
    if (geopf) return { results: geopf.map(fromGeopf) };
    if (photon) return { results: [] };
    throw new Error("La recherche d’adresse est momentanément indisponible");
  }

  if (text.length < 2) return { results: [] };
  const center = localPoint(lat, lng) ? { lat, lng } : STRASBOURG_SEARCH_CENTER;
  const waze = await wazeSearch(text, center, fetcher);
  if (waze.length) return { results: waze };
  const params = new URLSearchParams({
    q: text,
    limit: "6",
    lang: "fr",
    lat: String(center.lat),
    lon: String(center.lng),
    zoom: "12",
    location_bias_scale: "0.1",
  });
  const localParams = new URLSearchParams(params);
  localParams.set("bbox", STRASBOURG_SEARCH_BBOX.join(","));

  let photon = await request(`${PHOTON_BASE}/api/?${localParams}`, 3500);
  if (photon && !photon.length) photon = await request(`${PHOTON_BASE}/api/?${params}`, 3500);
  if (photon?.length) return { results: photon.map(fromPhoton) };

  const geopfParams = new URLSearchParams({ q: text.slice(0, 200), limit: "6", lat: String(center.lat), lon: String(center.lng) });
  const geopf = await request(`${GEOPF_BASE}/search?${geopfParams}`, 4000);
  if (geopf) return { results: geopf.map(fromGeopf) };
  if (photon) return { results: [] };
  throw new Error("La recherche d’adresse est momentanément indisponible");
}
