import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ platform: 'web', available: true, sync: vi.fn(), stop: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => state.platform, isPluginAvailable: () => state.available },
  registerPlugin: () => ({ sync: state.sync, stop: state.stop }),
}));
afterEach(() => { vi.useRealTimers(); vi.resetModules(); state.sync.mockReset(); state.stop.mockReset(); state.platform = 'web'; state.available = true; });

describe('pont des activités en direct', () => {
  it('ne fait rien sur le site web ou sans plugin natif', async () => {
    const bridge = await import('@/lib/live-activity-native');
    await bridge.syncLiveActivity({ kind: 'rider_trip', reference: 'r' });
    expect(state.sync).not.toHaveBeenCalled();
  });
  it('termine une offre expirée et ne la démarre pas', async () => {
    vi.useFakeTimers(); vi.setSystemTime(100000); state.platform = 'ios';
    const bridge = await import('@/lib/live-activity-native');
    await bridge.syncLiveActivity({ kind: 'driver_offer', reference: 'r', expiresAt: 99000 });
    expect(state.sync).not.toHaveBeenCalled();
    expect(state.stop).toHaveBeenCalledWith({ kind: 'driver_offer' });
  });
  it('synchronise dans l’ordre et termine les activités à la déconnexion', async () => {
    state.platform = 'ios'; state.sync.mockResolvedValue({}); state.stop.mockResolvedValue({});
    const bridge = await import('@/lib/live-activity-native');
    const update = bridge.syncLiveActivity({ kind: 'rider_trip', reference: 'r' });
    const stop = bridge.stopLiveActivitiesForSignOut();
    await Promise.all([update, stop]);
    expect(state.sync).toHaveBeenCalledOnce();
    expect(state.stop).toHaveBeenCalledWith({});
    expect(state.sync.mock.invocationCallOrder[0]).toBeLessThan(state.stop.mock.invocationCallOrder[0]);
    await bridge.syncLiveActivity({ kind: 'rider_trip', reference: 'r' });
    expect(state.sync).toHaveBeenCalledOnce();
  });
});
