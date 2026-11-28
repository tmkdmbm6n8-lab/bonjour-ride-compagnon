import { describe, it, expect } from 'vitest';
import {
  parseGoogleDuration, decodePolyline, routeFromGoogle, routeFromOsrm, approximateRoute,
  googleRouteRequest, liveTarget, liveRouteFresh, routeQualityLabel, LIVE_ROUTE_TTL_SECONDS,
} from '@/lib/vtc-routing';
import { drawableRoute } from '@/lib/utils/route-display';

describe('itinéraire Google avec trafic', () => {
  it('demande un calcul tenant compte du trafic en temps réel', () => {
    const body = googleRouteRequest({ lat: 48.58, lng: 7.75 }, { lat: 48.57, lng: 7.76 });
    expect(body.routingPreference).toBe('TRAFFIC_AWARE');
    expect(body.travelMode).toBe('DRIVE');
    expect(body.polylineQuality).toBe('HIGH_QUALITY');
    expect(body.origin.location.latLng).toEqual({ latitude: 48.58, longitude: 7.75 });
  });

  it('lit la durée Google en secondes sans arrondir', () => {
    expect(parseGoogleDuration('890s')).toBe(890);
    expect(parseGoogleDuration('12.5s')).toBe(12.5);
    expect(parseGoogleDuration('abc')).toBeNull();
  });

  it('décode le tracé Google (exemple de la documentation)', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252],
    ]);
  });

  it('garde la durée avec trafic et calcule le retard dû aux bouchons', () => {
    const r = routeFromGoogle({ routes: [{ distanceMeters: 6700, duration: '890s', staticDuration: '836s', polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' } }] });
    expect(r).toMatchObject({ distanceMeters: 6700, durationSeconds: 890, trafficDelaySeconds: 54, traffic: true, approximate: false });
  });

  it('refuse une réponse Google sans tracé', () => {
    expect(routeFromGoogle({ routes: [{ distanceMeters: 10, duration: '5s' }] })).toBeNull();
    expect(routeFromGoogle({})).toBeNull();
  });
});

describe('secours sans ligne droite', () => {
  it('OSRM est marqué sans trafic', () => {
    const r = routeFromOsrm({ routes: [{ distance: 1000, duration: 120, geometry: { coordinates: [[7.7, 48.5], [7.71, 48.51], [7.72, 48.52]] } }] });
    expect(r).toMatchObject({ traffic: false, approximate: false, durationSeconds: 120 });
  });

  it("l'estimation n'a aucun tracé et est signalée", () => {
    const r = approximateRoute(2);
    expect(r.geometry).toBeNull();
    expect(r.approximate).toBe(true);
    expect(routeQualityLabel(r)).toBe('Itinéraire indisponible — durée estimée');
  });

  it("une ligne droite à deux points n'est jamais dessinée", () => {
    expect(drawableRoute([[7.7, 48.5], [7.8, 48.6]])).toBeUndefined();
    expect(drawableRoute(null)).toBeUndefined();
    expect(drawableRoute([[1, 1], [2, 2], [3, 3]])).toHaveLength(3);
  });
});

describe('trajet en direct partagé', () => {
  const ride = { status: 'accepted', pickup: { lat: 1, lng: 2 }, dropoff: { lat: 3, lng: 4 } };
  it('vise la prise en charge puis la destination', () => {
    expect(liveTarget(ride)).toEqual({ kind: 'pickup', lat: 1, lng: 2 });
    expect(liveTarget({ ...ride, status: 'in_progress' })).toEqual({ kind: 'dropoff', lat: 3, lng: 4 });
    expect(liveTarget({ ...ride, status: 'arrived' })).toBeNull();
  });

  it('réutilise le calcul 45 s, puis recalcule', () => {
    const now = Date.parse('2026-11-14T10:00:00Z');
    const cached = { status: 'accepted', at: new Date(now - 44_000).toISOString() };
    expect(LIVE_ROUTE_TTL_SECONDS).toBe(45);
    expect(liveRouteFresh(cached, 'accepted', now)).toBe(true);
    expect(liveRouteFresh({ ...cached, at: new Date(now - 46_000).toISOString() }, 'accepted', now)).toBe(false);
    expect(liveRouteFresh(cached, 'in_progress', now)).toBe(false);
  });
});
