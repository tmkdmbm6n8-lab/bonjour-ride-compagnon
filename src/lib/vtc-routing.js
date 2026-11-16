// Itinéraires : Google Routes avec trafic en temps réel. En cas de panne,
// estimation signalée comme approximative et SANS tracé.
// Pure helpers only (unit-tested); the network calls live in vtc.server.js.

/** Seconds before a shared live route (driver → pickup/destination) is recomputed. */
export const LIVE_ROUTE_TTL_SECONDS = 45;

/** Google duration string ("890s", "12.5s") → seconds, or null when malformed. */
export function parseGoogleDuration(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  return m ? Number(m[1]) : null;
}

/** Decodes a Google encoded polyline into [[lng,lat],…] (GeoJSON order). */
export function decodePolyline(str) {
  if (typeof str !== 'string' || !str) return [];
  const out = [];
  let index = 0, lat = 0, lng = 0;
  while (index < str.length) {
    for (const axis of [0, 1]) {
      let result = 0, shift = 0, b;
      do {
        if (index >= str.length) return out;
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta; else lng += delta;
    }
    out.push([lng / 1e5, lat / 1e5]);
  }
  return out;
}

/** Request body for Routes API computeRoutes, traffic-aware, departing now. */
export function googleRouteRequest(a, b) {
  const wp = (p) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  return { origin: wp(a), destination: wp(b), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE', languageCode: 'fr-FR', units: 'METRIC' };
}
export const GOOGLE_ROUTE_FIELDS = 'routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.encodedPolyline';

/** computeRoutes JSON → route, or null when the answer is unusable. */
export function routeFromGoogle(json) {
  const r = json?.routes?.[0];
  if (!r) return null;
  const durationSeconds = parseGoogleDuration(r.duration);
  const geometry = decodePolyline(r.polyline?.encodedPolyline);
  if (durationSeconds == null || geometry.length < 2) return null;
  const staticSeconds = parseGoogleDuration(r.staticDuration);
  return {
    distanceMeters: Number.isFinite(r.distanceMeters) ? r.distanceMeters : 0, // omitted = 0 (protobuf JSON)
    durationSeconds,
    trafficDelaySeconds: staticSeconds == null ? 0 : Math.max(0, Math.round(durationSeconds - staticSeconds)),
    geometry,
    source: 'google',
    traffic: true,
    approximate: false,
  };
}

/** OSRM JSON → route without traffic, or null. */
export function routeFromOsrm(json) {
  const r = json?.routes?.[0];
  const geometry = r?.geometry?.coordinates;
  if (!r || !Number.isFinite(r.duration) || !Array.isArray(geometry) || geometry.length < 2) return null;
  return { distanceMeters: r.distance, durationSeconds: r.duration, trafficDelaySeconds: 0, geometry, source: 'osrm', traffic: false, approximate: false };
}

/** Last resort: distance/time estimate, flagged approximate, with no line to draw. */
export function approximateRoute(km) {
  const distanceMeters = Math.round(km * 1350);
  return { distanceMeters, durationSeconds: (distanceMeters / 25000) * 3600, trafficDelaySeconds: 0, geometry: null, source: 'estimate', traffic: false, approximate: true };
}

/** Where the driver is heading for this ride status, or null when no live leg applies. */
export function liveTarget(ride) {
  if (!ride) return null;
  if (ride.status === 'accepted') return { kind: 'pickup', lat: ride.pickup?.lat, lng: ride.pickup?.lng };
  if (ride.status === 'in_progress') return { kind: 'dropoff', lat: ride.dropoff?.lat, lng: ride.dropoff?.lng };
  return null;
}

/** A cached live route can be reused while fresh and computed for the same leg. */
export function liveRouteFresh(cached, status, now = Date.now()) {
  if (!cached || cached.status !== status || !cached.at) return false;
  return now - new Date(cached.at).getTime() < LIVE_ROUTE_TTL_SECONDS * 1000;
}

/** Short French label for how the time was computed. */
export function routeQualityLabel(route) {
  if (!route) return '';
  if (route.approximate) return 'Itinéraire indisponible — durée estimée';
  if (route.traffic) return route.trafficDelaySeconds >= 60 ? `Trafic en temps réel · +${Math.round(route.trafficDelaySeconds / 60)} min de bouchons` : 'Trafic en temps réel';
  return 'Sans info trafic';
}
