// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  liveListeners: new Map(),
  apiFetch: vi.fn(),
  setUpdateTokenEndpoint: vi.fn(),
  observePushToStartToken: vi.fn(),
  getActivityPushTokens: vi.fn(),
  endActivity: vi.fn(),
  available: vi.fn(),
  list: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('@/lib/archive-fetch', () => ({ apiFetch: state.apiFetch }));
vi.mock('@/lib/live-refresh', () => ({ publishRefresh: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios', isPluginAvailable: () => true }, registerPlugin: vi.fn() }));
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
    isAvailable: state.available,
    listActivities: state.list,
    endActivity: state.endActivity,
  },
}));

afterEach(() => {
  localStorage.clear();
  state.liveListeners.clear();
  vi.clearAllMocks();
  vi.resetModules();
  delete window.Capacitor;
  state.list.mockResolvedValue({ items: [] });
});

describe('jetons Dynamic Island du bon iPhone', () => {
  it('ferme immédiatement un jeton reçu après la fin de son offre seulement', async () => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    localStorage.setItem('sd_push_token', 'ef'.repeat(32));
    state.apiFetch.mockResolvedValue({ ok: true, json: async () => ({ closing: true }) });
    state.available.mockResolvedValue({ value: true });
    state.getActivityPushTokens.mockResolvedValue({ items: [] });
    const bridge = await import('@/lib/native-push');
    await bridge.registerDriverPush();
    state.list.mockResolvedValue({ items: [{ id: 'late-ride' }, { id: 'new-ride' }] });
    await state.liveListeners.get('liveActivityPushToken')({ id: 'late-ride', activityId: 'activity-late', token: 'cd'.repeat(32) });
    await vi.waitFor(() => expect(state.endActivity).toHaveBeenCalledWith({ id: 'late-ride', contentState: {}, dismissalPolicy: 'immediate' }));
    expect(state.endActivity).toHaveBeenCalledTimes(1);
  });
  it('associe démarrage et fermeture au même appareil puis les retire à la déconnexion', async () => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    localStorage.setItem('sd_push_token', 'ef'.repeat(32));
    state.apiFetch.mockResolvedValue({ ok: true, json: async () => ({ closing: false }) });
    state.setUpdateTokenEndpoint.mockResolvedValue(undefined);
    state.observePushToStartToken.mockResolvedValue(undefined);
    state.getActivityPushTokens.mockResolvedValue({ items: [] });
    state.available.mockResolvedValue({ value: true });
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
  it('retire l’association d’activité si les activités iOS sont désactivées, sans retirer le push classique', async () => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    localStorage.setItem('sd_push_token', 'ef'.repeat(32));
    localStorage.setItem('sd_live_activity_token', 'ab'.repeat(32));
    state.available.mockResolvedValue({ value: false });
    state.apiFetch.mockResolvedValue({ ok: true });
    const bridge = await import('@/lib/native-push');
    await bridge.registerDriverPush();
    expect(state.apiFetch).toHaveBeenCalledWith('/api/notifications/live-activity-token', expect.objectContaining({ method: 'DELETE' }));
    expect(state.observePushToStartToken).not.toHaveBeenCalled();
    expect(localStorage.getItem('sd_push_token')).toBe('ef'.repeat(32));
  });
});
