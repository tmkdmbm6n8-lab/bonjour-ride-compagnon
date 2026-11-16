// Adapted from waze-traffic-api-main (MIT). Unofficial endpoints: always fail open to other providers.
const BASE = 'https://www.waze.com/live-map/api/';
let retryAfter = 0;
const point = (p) => {
  const lat = p?.y ?? p?.latitude ?? p?.lat;
  const lng = p?.x ?? p?.longitude ?? p?.lng ?? p?.lon;
  return Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180 ? { lat, lng } : null;
};

async function request(path, options, fetcher) {
  if (Date.now() < retryAfter && fetcher === fetch) return null;
  try {
    const res = await fetcher(BASE + path, { ...options, signal: AbortSignal.timeout(3500), headers: { Accept: 'application/json', 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error('Waze unavailable');
    return await res.json();
  } catch {
    if (fetcher === fetch) retryAfter = Date.now() + 60_000;
    return null;
  }
}

export function routeFromWaze(json) {
  const alternative = json?.alternatives?.[0];
  const r = alternative?.response;
  const coords = alternative?.coords;
  if (!r || !Array.isArray(coords) || coords.length < 2 || !coords.every(point) || !Number.isFinite(r.totalSeconds) || r.totalSeconds < 0 || !Number.isFinite(r.totalLength) || r.totalLength < 0) return null;
  const alerts = (Array.isArray(r.alerts) ? r.alerts : []).flatMap((a) => {
    const p = point(a.location);
    const kind = a.type === 'POLICE' ? 'police' : /SPEED_CAM|RED_LIGHT_CAM/.test(a.subtype || '') ? 'radar' : a.type === 'JAM' ? 'traffic' : null;
    return p && kind ? [{ ...p, id: `waze:${a.id ?? `${kind}:${p.lat}:${p.lng}`}`, kind, source: 'waze', permanent: false }] : [];
  });
  return { geometry: coords.map((c) => { const p = point(c); return [p.lng, p.lat]; }), distanceMeters: r.totalLength, durationSeconds: r.totalSeconds, source: 'waze', traffic: true, trafficDelaySeconds: null, approximate: false, alerts };
}

export async function wazeRoute(a, b, fetcher = fetch) {
  const wp = (p) => ({ x: p.lng, y: p.lat });
  const json = await request('user-drive?geo_env=row', { method: 'POST', body: JSON.stringify({ from: wp(a), to: wp(b), nPaths: 1, useCase: 'LIVEMAP_PLANNING', interval: 100, arriveAt: false }) }, fetcher);
  return routeFromWaze(json);
}

export async function wazeSearch(text, center, fetcher = fetch) {
  const params = new URLSearchParams({ q: text.slice(0, 200), v: `${center.lat - 0.4},${center.lng - 0.6};${center.lat + 0.4},${center.lng + 0.6}`, exp: '8,10,12', 'geo-env': 'row', lang: 'fr' });
  const json = await request(`autocomplete?${params}`, {}, fetcher);
  if (!Array.isArray(json)) return [];
  return json.flatMap((item) => {
    const p = point(item.latLng);
    return p && typeof item.name === 'string' ? [{ ...p, name: item.cleanName || item.name, address: item.address || item.name, type: 'address', source: 'waze' }] : [];
  }).slice(0, 6);
}
