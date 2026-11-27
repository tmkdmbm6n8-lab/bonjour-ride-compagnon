// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_ACTIVITY_TEST_DRIVER_ID } from '@/lib/live-activity-offers';
import {
  endRideOfferLiveActivities,
  registerLiveActivityUpdateToken,
  startRideOfferLiveActivities,
} from '@/lib/vtc-push.server';

const NOW = Date.now();
const token = 'ab'.repeat(32);
const ride = {
  id: '6f1f0cf5-2d0d-4db2-a8f1-2f2d64305ef5',
  is_test: true,
  status: 'searching',
  rider_id: 'admin',
  offer_expires_at: new Date(NOW + 60_000).toISOString(),
  fare: { driverEarnings: 12.4 },
  declined: [],
};

function selectQuery(rows) {
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    then: (resolve) => Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  return query;
}

beforeEach(() => {
  vi.stubEnv('APNS_KEY_ID', 'KEY123');
  vi.stubEnv('APNS_TEAM_ID', 'TEAM123');
  vi.stubEnv('APNS_PRIVATE_KEY', Buffer.from('test-key').toString('base64'));
  vi.stubEnv('APNS_ENV', 'sandbox');
  vi.spyOn(crypto.subtle, 'importKey').mockResolvedValue({});
  vi.spyOn(crypto.subtle, 'sign').mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200 })));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('envoi Apple Dynamic Island', () => {
  it('utilise le canal liveactivity et le sujet du bundle pour GenericAttributes', async () => {
    const admin = { from: vi.fn(() => ({ select: () => selectQuery([{ token, user_id: LIVE_ACTIVITY_TEST_DRIVER_ID }]) })) };
    const result = await startRideOfferLiveActivities(admin, ride, [LIVE_ACTIVITY_TEST_DRIVER_ID]);
    expect(result).toEqual({ sent: 1 });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`https://api.sandbox.push.apple.com/3/device/${token}`);
    expect(init.headers['apns-push-type']).toBe('liveactivity');
    expect(init.headers['apns-topic']).toBe('fr.strasdrive.app.push-type.liveactivity');
    expect(init.headers['apns-collapse-id']).toBe(`ride-${ride.id}`);
    expect(JSON.parse(init.body).aps['attributes-type']).toBe('GenericAttributes');
  });

  it('ne sollicite ni les jetons ni Apple pour une vraie course', async () => {
    const admin = { from: vi.fn() };
    await startRideOfferLiveActivities(admin, { ...ride, is_test: false }, [LIVE_ACTIVITY_TEST_DRIVER_ID]);
    expect(admin.from).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('ferme tous les jetons de l’offre avec une disparition immédiate', async () => {
    const deleted = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) }));
    const admin = { from: vi.fn(() => ({ select: () => selectQuery([{ token, user_id: 'driver', ride_id: ride.id }]), delete: deleted })) };
    await endRideOfferLiveActivities(admin, ride.id);
    const [, init] = fetch.mock.calls[0];
    expect(JSON.parse(init.body).aps.event).toBe('end');
    expect(JSON.parse(init.body).aps['dismissal-date']).toBeTypeOf('number');
    expect(deleted).toHaveBeenCalledOnce();
  });

  it('ferme immédiatement un jeton reçu après la fin de l’offre', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const deleted = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) }));
    const admin = {
      from: vi.fn((table) => table === 'rides'
        ? { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }
        : { upsert, select: () => selectQuery([{ token, user_id: LIVE_ACTIVITY_TEST_DRIVER_ID, ride_id: ride.id }]), delete: deleted }),
    };
    const result = await registerLiveActivityUpdateToken(admin, {
      userId: LIVE_ACTIVITY_TEST_DRIVER_ID,
      deviceId: 'device_1234567890abcdef',
      rideId: ride.id,
      activityId: 'activity-1',
      token,
    });
    expect(result).toEqual({ ok: true, closing: true });
    expect(upsert).toHaveBeenCalledOnce();
    expect(JSON.parse(fetch.mock.calls[0][1].body).aps.event).toBe('end');
  });
});
