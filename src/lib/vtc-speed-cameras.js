import { haversineDistance } from './utils/geo';

/** Bounded, grid-aligned queries let nearby map views share cached Overpass answers. */
export function cameraBounds(value) {
  const b = Array.isArray(value) ? value : String(value || '').split(',').map(Number);
  if (b.length !== 4 || !b.every(Number.isFinite)) throw new Error('Zone de carte invalide');
  const [west, south, east, north] = b;
  if (west < -180 || east > 180 || south < -90 || north > 90 || east <= west || north <= south || east - west > 1 || north - south > 1) throw new Error('Zoomez pour afficher les radars');
  return [Math.max(-180, Math.floor(west * 10) / 10), Math.max(-90, Math.floor(south * 10) / 10), Math.min(180, Math.ceil(east * 10) / 10), Math.min(90, Math.ceil(north * 10) / 10)];
}

export function camerasFromOverpass(json) {
  if (!Array.isArray(json?.elements) || json.remark) throw new Error('Réponse Overpass indisponible');
  const seen = new Set();
  return json.elements.flatMap((n) => {
    if (n.type !== 'node' || n.tags?.highway !== 'speed_camera' || !Number.isSafeInteger(n.id) || !Number.isFinite(n.lat) || Math.abs(n.lat) > 90 || !Number.isFinite(n.lon) || Math.abs(n.lon) > 180 || seen.has(n.id)) return [];
    seen.add(n.id);
    return [{ id: `osm:node:${n.id}`, kind: 'radar', lat: n.lat, lng: n.lon, source: 'osm', permanent: true,
      maxspeed: typeof n.tags.maxspeed === 'string' ? n.tags.maxspeed.slice(0, 20) : null }];
  });
}

/** A manually reported camera and the same OSM camera should appear only once. */
export function mergeCameraAlerts(alerts, cameras) {
  const radars = alerts.filter(a => a.kind === 'radar');
  const ids = new Set(alerts.map(a => a.id));
  return [...alerts, ...cameras.filter(c => !ids.has(c.id) && !radars.some(a => haversineDistance(a.lat, a.lng, c.lat, c.lng) * 1000 < 60))];
}
