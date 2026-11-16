// Address lookup stays server-side through the existing managed Google Maps connector.
export const STRASBOURG_SEARCH_CENTER = { lat: 48.5734, lng: 7.7521 };
export const STRASBOURG_SEARCH_BBOX = [7.2, 48.22, 8.3, 48.93];
const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

export async function geoSearch(q, fetcher = fetch) {
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
  const token = process.env.LOVABLE_API_KEY,
    key = process.env.GOOGLE_MAPS_API_KEY;
  if (!token || !key) throw new Error("La recherche Google Maps n’est pas encore configurée");
  const params = new URLSearchParams({ language: "fr", region: "fr" });
  if (reverse) params.set("latlng", `${lat},${lng}`);
  else {
    params.set("address", text);
    params.set("bounds", "48.22,7.2|48.93,8.3");
  }
  try {
    const response = await fetcher(`${GATEWAY}/maps/api/geocode/json?${params}`, {
      headers: { Authorization: `Bearer ${token}`, "X-Connection-Api-Key": key },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Google indisponible");
    const data = await response.json();
    if (data.status === "ZERO_RESULTS") return { results: [] };
    if (data.status !== "OK") throw new Error("Google indisponible");
    return {
      results: (data.results || [])
        .filter(
          (r) =>
            Number.isFinite(r.geometry?.location?.lat) &&
            Number.isFinite(r.geometry?.location?.lng),
        )
        .slice(0, reverse ? 1 : 6)
        .map((r) => ({
          name: r.formatted_address?.split(",")[0] || "Adresse",
          address: r.formatted_address || "Adresse",
          lat: r.geometry.location.lat,
          lng: r.geometry.location.lng,
          type: r.types?.[0] || "",
        })),
    };
  } catch {
    throw new Error("La recherche d’adresse Google Maps est momentanément indisponible");
  }
}
