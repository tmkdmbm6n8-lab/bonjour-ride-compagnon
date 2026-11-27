// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_ACTIVITY_TEST_DRIVER_ID, pushDeviceId } from '@/lib/live-activity-offers';
import {
  endRideOfferLiveActivities,
  registerLiveActivityUpdateToken,
  startRideOfferLiveActivities,
  pushRideOffer,
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
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('', { status: 200 })));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('envoi Apple Dynamic Island', () => {
  it('utilise le canal liveactivity et le sujet du bundle pour GenericAttributes', async () => {
    const deviceId = await pushDeviceId(token);
    const admin = { from: vi.fn(() => ({ select: () => selectQuery([{ token, user_id: LIVE_ACTIVITY_TEST_DRIVER_ID, device_id: deviceId }]) })) };
    const result = await startRideOfferLiveActivities(admin, ride, [LIVE_ACTIVITY_TEST_DRIVER_ID]);
    expect(result).toEqual({ sent: 1, devices: [{ userId: LIVE_ACTIVITY_TEST_DRIVER_ID, deviceId }] });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`https://api.sandbox.push.apple.com/3/device/${token}`);
    expect(init.headers['apns-push-type']).toBe('liveactivity');
    expect(init.headers['apns-topic']).toBe('fr.strasdrive.app.push-type.liveactivity');
    expect(init.headers['apns-collapse-id']).toBe(`ride-${ride.id}`);
    expect(JSON.parse(init.body).aps['attributes-type']).toBe('GenericAttributes');
  });

  it('démarre une vraie offre pour un chauffeur autre que le compte de test', async () => {
    const admin = { from: vi.fn(() => ({ select: () => selectQuery([{ token, user_id: 'driver', device_id: 'a'.repeat(64) }]) })) };
    await startRideOfferLiveActivities(admin, { ...ride, is_test: false }, ['driver']);
    expect(fetch).toHaveBeenCalledOnce();
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

describe('une alerte par appareil', () => {
  async function setup(liveRows = true) {
    const deviceId = await pushDeviceId(token);
    const admin = { from: vi.fn((table) => ({ select: () => selectQuery(table === 'push_tokens'
      ? [{ token, user_id: LIVE_ACTIVITY_TEST_DRIVER_ID }, { token: 'cd'.repeat(32), user_id: LIVE_ACTIVITY_TEST_DRIVER_ID }]
      : liveRows ? [{ token: 'ef'.repeat(32), user_id: LIVE_ACTIVITY_TEST_DRIVER_ID, device_id: deviceId }] : []) })) };
    return admin;
  }
  it('évite la bannière classique sur le même iPhone mais la garde sur un autre téléphone', async () => {
    await pushRideOffer(await setup(), ride, [LIVE_ACTIVITY_TEST_DRIVER_ID]);
    expect(fetch).toHaveBeenCalledTimes(2);
    const channels = fetch.mock.calls.map(([, init]) => init.headers['apns-push-type']);
    expect(channels).toEqual(['liveactivity', 'alert']);
    expect(fetch.mock.calls.some(([url]) => url.endsWith(`/device/${token}`))).toBe(false);
    expect(fetch.mock.calls.some(([url]) => url.endsWith(`/device/${'cd'.repeat(32)}`))).toBe(true);
  });
  it('conserve les notifications classiques sans activité compatible', async () => {
    await pushRideOffer(await setup(false), ride, [LIVE_ACTIVITY_TEST_DRIVER_ID]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.every(([, init]) => init.headers['apns-push-type'] === 'alert')).toBe(true);
  });
  it('rétablit la notification classique si Apple rejette le démarrage', async () => {
    fetch.mockResolvedValueOnce(new Response('{"reason":"BadDeviceToken"}', { status: 400 }));
    await pushRideOffer(await setup(), ride, [LIVE_ACTIVITY_TEST_DRIVER_ID]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls.filter(([, init]) => init.headers['apns-push-type'] === 'alert')).toHaveLength(2);
  });
});
