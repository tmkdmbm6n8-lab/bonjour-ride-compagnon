import { describe, expect, it } from 'vitest';
import { routeFromWaze, wazeRoute, wazeSearch } from '../lib/vtc-waze.server.js';

describe('Waze adapter', () => {
  it('converts route coordinates, ETA and only supported alerts', () => {
    const route = routeFromWaze({ alternatives: [{ coords: [{ x: 7, y: 48 }, { x: 8, y: 49 }], response: {
      totalLength: 1200, totalSeconds: 240, alerts: [
        { id: 1, type: 'POLICE', location: { x: 7, y: 48 } },
        { id: 2, type: 'JAM', location: { x: 7, y: 48 } },
        { id: 3, subtype: 'SPEED_CAM', location: { x: 7, y: 48 } },
        { id: 4, type: 'UNKNOWN', location: { x: 7, y: 48 } },
      ],
    } }] });
    expect(route?.geometry).toEqual([[7, 48], [8, 49]]);
    expect(route?.durationSeconds).toBe(240);
    expect(route?.trafficDelaySeconds).toBeNull();
    expect(route?.alerts.map(a => a.kind)).toEqual(['police', 'traffic', 'radar']);
    expect(routeFromWaze({ alternatives: [] })).toBeNull();
  });
  it('falls back when Waze refuses routing or search', async () => {
    const denied = async () => new Response('', { status: 403 });
    expect(await wazeRoute({ lat: 48, lng: 7 }, { lat: 49, lng: 8 }, denied)).toBeNull();
    expect(await wazeSearch('gare', { lat: 48, lng: 7 }, denied)).toEqual([]);
  });
  it('normalizes address search and drops invalid coordinates', async () => {
    const fetcher = async () => new Response(JSON.stringify([
      { name: 'Gare', address: 'Strasbourg', latLng: { x: 7.7, y: 48.5 } },
      { name: 'Invalid', latLng: { x: 700, y: 48 } },
    ]));
    expect(await wazeSearch('gare', { lat: 48, lng: 7 }, fetcher)).toEqual([
      { name: 'Gare', address: 'Strasbourg', lat: 48.5, lng: 7.7, type: 'address', source: 'waze' },
    ]);
  });
});
