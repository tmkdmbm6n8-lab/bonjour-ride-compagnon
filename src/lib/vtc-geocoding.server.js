// Photon stays keyless. Search Strasbourg and its surroundings before widening.
const PHOTON_BASE = "https://photon.komoot.io";
export const STRASBOURG_SEARCH_CENTER = { lat: 48.5734, lng: 7.7521 };
export const STRASBOURG_SEARCH_BBOX = [7.2, 48.22, 8.3, 48.93];

function localPoint(lat, lng) {
  const [west, south, east, north] = STRASBOURG_SEARCH_BBOX;
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= south && lat <= north && lng >= west && lng <= east;
}

export async function geoSearch(q, fetcher = fetch) {
  const reverse = q.get("reverse") === "1";
  const lat = parseFloat(q.get("lat")),
    lng = parseFloat(q.get("lng"));
  const text = (q.get("q") || "").trim();
  async function request(url) {
    try {
      const res = await fetcher(url, {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "strasdrive/1.0" },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      return (data.features || []).filter(
        (f) =>
          Array.isArray(f.geometry?.coordinates) &&
          Number.isFinite(f.geometry.coordinates[0]) &&
          Number.isFinite(f.geometry.coordinates[1]),
      );
    } catch {
      throw new Error("La recherche d’adresse est momentanément indisponible");
    }
  }
  let features;
  if (reverse) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Latitude et longitude requises");
    features = await request(`${PHOTON_BASE}/reverse?lon=${lng}&lat=${lat}&limit=1&lang=fr`);
  } else {
    if (text.length < 2) return { results: [] };
    const center = localPoint(lat, lng) ? { lat, lng } : STRASBOURG_SEARCH_CENTER;
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
    features = await request(`${PHOTON_BASE}/api/?${localParams}`);
    if (!features.length) features = await request(`${PHOTON_BASE}/api/?${params}`);
  }
  return {
    results: features.map((f) => {
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
    }),
  };
}
