import { describe, expect, it } from 'vitest';
import { sanitizeTripPrefs, tripPrefsAllow, riderAverage, isFiltering } from '@/lib/vtc-trip-prefs';
import { planDispatch, canSeeOffer } from '@/lib/vtc-dispatch';

const pickup = { lat: 48.5839, lng: 7.7455 };
const driver = (id: string, trip_prefs: Record<string, unknown> = {}) => ({ user_id: id, is_priority: false, location: pickup, vehicle_class: 'economy', trip_prefs });
// 10 km, 15 € net pour le chauffeur → 1,50 €/km (chauffeur déjà au point de départ)
const ride = (extra: Record<string, unknown> = {}) => ({
  id: 'r1', status: 'searching', vehicle_type: 'economy', pickup, declined: [] as string[],
  dispatch_phase: null, offer_driver_id: null, offer_expires_at: null,
  route: { distanceMeters: 10000 }, fare: { driverEarnings: 15 }, payment: { method: 'wallet' }, rider_rating: null,
  ...extra,
});

describe('préférences de course du chauffeur', () => {
  it('par défaut tout est accepté et rien n’est filtré', () => {
    expect(sanitizeTripPrefs(undefined)).toEqual({ acceptCash: true, minRiderRating: null, minPayPerKm: null });
    expect(isFiltering({})).toBe(false);
  });

  it('refuse les valeurs hors liste (note ou €/km inventés)', () => {
    expect(sanitizeTripPrefs({ minRiderRating: 4.99, minPayPerKm: 0.1 })).toEqual({ acceptCash: true, minRiderRating: null, minPayPerKm: null });
  });

  it('un chauffeur qui refuse les espèces ne reçoit pas les courses payées en espèces', () => {
    const d = driver('a', { acceptCash: false });
    expect(tripPrefsAllow(d, ride({ payment: { method: 'cash' } }))).toBe(false);
    expect(tripPrefsAllow(d, ride())).toBe(true);
  });

  it('note minimale 4,5 : écarte un passager noté 4,2, garde un passager sans note', () => {
    const d = driver('a', { minRiderRating: 4.5 });
    expect(tripPrefsAllow(d, ride({ rider_rating: 4.2 }))).toBe(false);
    expect(tripPrefsAllow(d, ride({ rider_rating: 4.6 }))).toBe(true);
    expect(tripPrefsAllow(d, ride({ rider_rating: null }))).toBe(true);
  });

  it('gain minimum 1,75 €/km : écarte une course à 1,50 €/km, garde à 1,50 €/km minimum', () => {
    expect(tripPrefsAllow(driver('a', { minPayPerKm: 1.75 }), ride())).toBe(false);
    expect(tripPrefsAllow(driver('a', { minPayPerKm: 1.5 }), ride())).toBe(true);
  });

  it('la note moyenne d’un passager ne compte qu’à partir de 3 notes', () => {
    expect(riderAverage([5, 4])).toBeNull();
    expect(riderAverage([5, 4, 3])).toBe(4);
  });

  it('la course passe au chauffeur suivant quand les préférences du plus proche la refusent', () => {
    const picky = driver('difficile', { acceptCash: false });
    const other = { ...driver('autre'), location: { lat: pickup.lat + 0.02, lng: pickup.lng } };
    const r = ride({ payment: { method: 'cash' } });
    const patch = planDispatch(r, [picky, other]);
    expect(patch?.offer_driver_id).toBe('autre');
    const live = { ...r, ...patch };
    expect(canSeeOffer(live, picky, Date.now(), [picky, other] as any)).toBe(false);
  });
});
