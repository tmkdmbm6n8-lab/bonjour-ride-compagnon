import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  list: vi.fn(), current: vi.fn(), end: vi.fn(), update: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'ios', isPluginAvailable: (name: string) => name === 'LiveActivity' },
  registerPlugin: vi.fn(),
}));
vi.mock('capacitor-live-activity', () => ({ LiveActivity: {
  listActivities: state.list, getCurrentActivity: state.current,
  endActivity: state.end, updateActivity: state.update,
} }));
afterEach(() => { vi.resetModules(); vi.clearAllMocks(); });

describe('fermeture native GenericAttributes', () => {
  it('ferme immédiatement après refus ou acceptation sans utiliser l’ancien module', async () => {
    state.list.mockResolvedValue({ items: [{ id: 'ride-1' }] });
    const bridge = await import('@/lib/live-activity-native');
    await bridge.stopLiveActivity('driver_offer');
    expect(state.end).toHaveBeenCalledWith({ id: 'ride-1', contentState: {}, dismissalPolicy: 'immediate' });
  });
  it('efface les offres expirées au lancement sans effacer l’offre encore valable', async () => {
    state.list.mockResolvedValue({ items: [{ id: 'expired' }, { id: 'valid' }] });
    state.current.mockImplementation(async ({ id }: { id: string }) => ({ values: {
      type: 'driver_offer', expiresAt: String(Math.floor(Date.now() / 1000) + (id === 'valid' ? 60 : -60)),
    } }));
    const bridge = await import('@/lib/live-activity-native');
    await bridge.reconcileOfferActivities();
    expect(state.end).toHaveBeenCalledTimes(1);
    expect(state.end).toHaveBeenCalledWith({ id: 'expired', contentState: {}, dismissalPolicy: 'immediate' });
  });
  it('la synchronisation foreground ne démarre jamais un deuxième widget', async () => {
    state.list.mockResolvedValue({ items: [] });
    const bridge = await import('@/lib/live-activity-native');
    await bridge.syncLiveActivity({ kind: 'driver_offer', reference: 'ride', expiresAt: Date.now() + 1000 });
    expect(state.update).not.toHaveBeenCalled();
    await bridge.stopLiveActivity('driver_offer');
  });
});