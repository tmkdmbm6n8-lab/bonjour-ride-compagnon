import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  list: vi.fn(), current: vi.fn(), end: vi.fn(), update: vi.fn(),
  nativeAvailable: false, nativeEnd: vi.fn(), nativeConfigure: vi.fn(), nativeClear: vi.fn(), nativeReconcile: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'ios', isPluginAvailable: (name: string) => name === 'LiveActivity' || (name === 'StrasDriveOffers' && state.nativeAvailable) },
  registerPlugin: vi.fn(() => ({ endOffers: state.nativeEnd, configure: state.nativeConfigure, clear: state.nativeClear, reconcile: state.nativeReconcile })),
}));
vi.mock('capacitor-live-activity', () => ({ LiveActivity: {
  listActivities: state.list, getCurrentActivity: state.current,
  endActivity: state.end, updateActivity: state.update,
} }));
afterEach(() => { state.nativeAvailable = false; vi.resetModules(); vi.clearAllMocks(); });

describe('fermeture native GenericAttributes', () => {
  it('ferme une offre Apple même si la liste du module est vide, sans toucher à une nouvelle offre', async () => {
    state.nativeAvailable = true;
    state.list.mockResolvedValue({ items: [] });
    const bridge = await import('@/lib/live-activity-native');
    await bridge.stopLiveActivity('driver_offer', 'accepted-ride');
    expect(state.nativeEnd).toHaveBeenCalledWith({ id: 'accepted-ride' });
    expect(state.list).not.toHaveBeenCalled();
    expect(state.end).not.toHaveBeenCalled();
  });
  it('configure le rappel natif et efface son association à la déconnexion', async () => {
    state.nativeAvailable = true;
    const bridge = await import('@/lib/live-activity-native');
    const url = 'https://strasdrive.fr/api/public/native/live-activity-token?device=' + 'ab'.repeat(32);
    await bridge.configureNativeOfferTokens(url);
    await bridge.clearNativeOfferTokens();
    expect(state.nativeConfigure).toHaveBeenCalledWith({ url });
    expect(state.nativeClear).toHaveBeenCalledTimes(1);
  });
  it('nettoie les activités Apple directement au lancement', async () => {
    state.nativeAvailable = true;
    const bridge = await import('@/lib/live-activity-native');
    await bridge.reconcileOfferActivities();
    expect(state.nativeReconcile).toHaveBeenCalledTimes(1);
    expect(state.list).not.toHaveBeenCalled();
  });
  it('le secours ancien ne ferme que la course acceptée', async () => {
    state.list.mockResolvedValue({ items: [{ id: 'accepted' }, { id: 'new-offer' }] });
    const bridge = await import('@/lib/live-activity-native');
    await bridge.stopLiveActivity('driver_offer', 'accepted');
    expect(state.end).toHaveBeenCalledTimes(1);
    expect(state.end).toHaveBeenCalledWith({ id: 'accepted', contentState: {}, dismissalPolicy: 'immediate' });
  });
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