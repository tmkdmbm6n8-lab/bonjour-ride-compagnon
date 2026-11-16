import snapshot from '../data/speed-cameras-fr.json';
import { cameraBounds } from './vtc-speed-cameras';
import { speedCameras as overpassCameras } from './vtc-speed-cameras.server';

export function requireCameraReader(role) {
  if (role !== 'driver') throw new Error('Accès chauffeur requis');
}

/** Bundled server data remains available even when every external API is down. */
export function officialCameras(value) {
  const [west, south, east, north] = cameraBounds(value);
  const cameras = snapshot.cameras.filter(c => c.lng >= west && c.lng <= east && c.lat >= south && c.lat <= north)
    .map(c => ({ ...c, id: `fr:${c.id}`, source: 'official-fr', kind: 'radar', permanent: true, sourceUpdatedAt: snapshot.publishedAt }));
  return { cameras, available: true, stale: false, source: 'official-fr', sourceUpdatedAt: snapshot.publishedAt };
}

export async function speedCameras(value) {
  const bounds = cameraBounds(value);
  const official = officialCameras(value);
  const [west, south, east, north] = bounds;
  // Mainland France and Corsica: do not wait for Overpass to display known cameras.
  if (official.cameras.length || (west >= -5.6 && east <= 10 && south >= 41 && north <= 51.6)) return official;
  return overpassCameras(value);
}
