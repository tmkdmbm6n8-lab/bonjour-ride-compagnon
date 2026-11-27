// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  liveListeners: new Map(),
  apiFetch: vi.fn(),
  setUpdateTokenEndpoint: vi.fn(),
  observePushToStartToken: vi.fn(),
  getActivityPushTokens: vi.fn(),
}));

vi.mock('@/lib/archive-fetch', () => ({ apiFetch: state.apiFetch }));
vi.mock('@/lib/live-refresh', () => ({ publishRefresh: vi.fn() }));
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    checkPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }),
    requestPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }),
    register: vi.fn().mockResolvedValue(undefined),
    removeAllListeners: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('capacitor-live-activity', () => ({
  LiveActivity: {
    addListener: vi.fn((name, listener) => {
      state.liveListeners.set(name, listener);
      return Promise.resolve({ remove: vi.fn() });
    }),
    setUpdateTokenEndpoint: state.setUpdateTokenEndpoint,
    observePushToStartToken: state.observePushToStartToken,
    getActivityPushTokens: state.getActivityPushTokens,
  },
}));

afterEach(() => {
  localStorage.clear();
  state.liveListeners.clear();
  vi.clearAllMocks();
  vi.resetModules();
  delete window.Capacitor;
});

describe('jetons Dynamic Island du bon iPhone', () => {
  it('associe démarrage et fermeture au même appareil puis les retire à la déconnexion', async () => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    state.apiFetch.mockResolvedValue({ ok: true });
    state.setUpdateTokenEndpoint.mockResolvedValue(undefined);
    state.observePushToStartToken.mockResolvedValue(undefined);
    state.getActivityPushTokens.mockResolvedValue({ items: [] });
    const bridge = await import('@/lib/native-push');
    await bridge.registerDriverPush();

    await state.liveListeners.get('liveActivityPushToStartToken')({ token: 'ab'.repeat(32) });
    await state.liveListeners.get('liveActivityPushToken')({ id: 'ride-1', activityId: 'activity-1', token: 'cd'.repeat(32) });
    await vi.waitFor(() => expect(state.apiFetch).toHaveBeenCalledTimes(2));

    const start = JSON.parse(state.apiFetch.mock.calls[0][1].body);
    const update = JSON.parse(state.apiFetch.mock.calls[1][1].body);
    expect(start.deviceId).toMatch(/^.{16,80}$/);
    expect(update.deviceId).toBe(start.deviceId);
    expect(update).toMatchObject({ rideId: 'ride-1', activityId: 'activity-1' });
    expect(state.setUpdateTokenEndpoint.mock.calls[0][0].url).toContain(`device=${encodeURIComponent(start.deviceId)}`);

    await bridge.unregisterDriverPush();
    const removal = state.apiFetch.mock.calls.find(([path, options]) => path === '/api/notifications/live-activity-token' && options.method === 'DELETE');
    expect(removal).toBeTruthy();
    expect(JSON.parse(removal[1].body)).toEqual({ token: 'ab'.repeat(32), deviceId: start.deviceId });
  });
});
