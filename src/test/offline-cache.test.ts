import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOfflineData, flushSettings, queueSetting, readSettingsQueue, recallRead, rememberRead } from '@/lib/offline-cache';

describe('offline cache', () => {
  beforeEach(() => localStorage.clear());
  it('replays a saved read', () => { rememberRead('/api/drivers/me', { a: 1 }); expect(recallRead('/api/drivers/me')).toEqual({ a: 1 }); });
  it('never caches money or map calls', () => { rememberRead('/api/geo/search?q=x', 1); expect(recallRead('/api/geo/search?q=x')).toBeUndefined(); });
  it('refuses to queue non-settings writes', () => { expect(queueSetting('/api/wallet/withdraw', 'POST', {})).toBe(false); });
  it('merges trip preferences and empties after sending', async () => {
    queueSetting('/api/drivers/me/preferences', 'PATCH', { tripPrefs: { acceptCash: false } });
    queueSetting('/api/drivers/me/preferences', 'PATCH', { tripPrefs: { minRiderRating: 4 } });
    expect(readSettingsQueue()).toHaveLength(1);
    const send = vi.fn().mockResolvedValue({});
    await flushSettings(send, () => false);
    expect(send.mock.calls[0]?.[0].body.tripPrefs).toEqual({ acceptCash: false, minRiderRating: 4 });
    expect(readSettingsQueue()).toHaveLength(0);
  });
  it('keeps the queue on network failure and clears on sign-out', async () => {
    queueSetting('/api/drivers/me/classes', 'PATCH', { acceptsClasses: ['go'] });
    await flushSettings(() => Promise.reject(new TypeError('x')), (e: unknown) => e instanceof TypeError);
    expect(readSettingsQueue()).toHaveLength(1);
    clearOfflineData(); expect(readSettingsQueue()).toHaveLength(0);
  });
});
