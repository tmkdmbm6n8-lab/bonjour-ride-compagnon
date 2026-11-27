import { describe, expect, it } from 'vitest';
import {
  LIVE_ACTIVITY_TEST_DRIVER_ID,
  buildLiveActivityEnd,
  buildLiveActivityStart,
  liveActivityOfferDriverIds,
  shouldCloseLiveActivityOffer,
  validLiveActivityDeviceId,
  validLiveActivityToken,
} from '@/lib/live-activity-offers';

const NOW = Date.parse('2026-11-27T18:00:00Z');
const ride = {
  id: '7d4b1c83-8b0c-4f0e-a783-test',
  is_test: true,
  status: 'searching',
  offer_expires_at: new Date(NOW + 60_000).toISOString(),
  fare: { driverEarnings: 12.4 },
  declined: [] as string[],
};

describe('Dynamic Island — course test GenericAttributes', () => {
  it('autorise uniquement le compte Tata et jamais une vraie course', () => {
    expect(liveActivityOfferDriverIds(ride, ['autre', LIVE_ACTIVITY_TEST_DRIVER_ID])).toEqual([LIVE_ACTIVITY_TEST_DRIVER_ID]);
    expect(liveActivityOfferDriverIds({ ...ride, is_test: false }, [LIVE_ACTIVITY_TEST_DRIVER_ID])).toEqual([]);
  });

  it('envoie le format exact attendu par GenericAttributes, avec des valeurs texte', () => {
    const start = buildLiveActivityStart(ride, NOW);
    expect(start?.payload.aps['attributes-type']).toBe('GenericAttributes');
    expect(start?.payload.aps.attributes).toEqual({ id: ride.id, staticValues: { type: 'driver_offer' } });
    expect(start?.payload.aps['content-state'].values).toMatchObject({ title: 'Course', status: 'Nouvelle course', earnings: '12,40 €' });
    expect(Object.values(start?.payload.aps['content-state'].values || {}).every((value) => typeof value === 'string')).toBe(true);
    expect(start?.expiresAt).toBe(Math.floor((NOW + 60_000) / 1000));
  });

  it('n’envoie pas de bulle si l’offre est déjà expirée', () => {
    expect(buildLiveActivityStart(ride, NOW + 61_000)).toBeNull();
  });

  it('ferme au refus, à l’acceptation et à l’expiration', () => {
    expect(shouldCloseLiveActivityOffer({ ...ride, declined: ['driver'] }, 'driver', NOW)).toBe(true);
    expect(shouldCloseLiveActivityOffer({ ...ride, status: 'accepted' }, 'autre', NOW)).toBe(true);
    expect(shouldCloseLiveActivityOffer(ride, 'driver', NOW + 60_000)).toBe(true);
    expect(shouldCloseLiveActivityOffer(ride, 'driver', NOW + 1_000)).toBe(false);
  });

  it('demande la disparition immédiate et rejette les identifiants invalides', () => {
    const end = buildLiveActivityEnd(NOW);
    expect(end.payload.aps.event).toBe('end');
    expect(end.payload.aps['dismissal-date']).toBe(Math.floor(NOW / 1000));
    expect(validLiveActivityToken('ab'.repeat(32))).toHaveLength(64);
    expect(validLiveActivityToken('token-public')).toBeNull();
    expect(validLiveActivityDeviceId('device_1234567890abcdef')).toBeTruthy();
    expect(validLiveActivityDeviceId('court')).toBeNull();
  });
});
