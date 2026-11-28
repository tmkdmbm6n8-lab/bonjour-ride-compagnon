import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchRefresh, publishRefresh } from '../lib/live-refresh';

describe('live refresh lifecycle', () => {
  let stop: (() => void) | undefined;
  beforeEach(() => { vi.useFakeTimers(); Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });
  afterEach(() => { stop?.(); vi.useRealTimers(); });
  it('coalesces events during a pending request and rechecks after it finishes', async () => {
    let finish: (() => void) | undefined;
    const refresh = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; })).mockResolvedValue(undefined);
    stop = watchRefresh(refresh, 5000);
    publishRefresh(); publishRefresh(); window.dispatchEvent(new Event('online'));
    expect(refresh).toHaveBeenCalledTimes(1);
    if (!finish) throw new Error('Refresh did not start');
    finish(); await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });
  it('pauses while hidden, refreshes on return and removes all listeners on cleanup', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    stop = watchRefresh(refresh, 5000);
    await vi.advanceTimersByTimeAsync(0);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    await vi.advanceTimersByTimeAsync(15000);
    expect(refresh).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(2);
    stop();
    publishRefresh(); window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(10000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('discards late responses after unmount', async () => {
    let active: (() => boolean) | undefined;
    stop = watchRefresh((check: () => boolean) => { active = check; return new Promise(() => {}); });
    if (!active) throw new Error('Refresh did not start');
    expect(active()).toBe(true); stop(); expect(active()).toBe(false);
  });
  it('refreshes on cross-tab invalidation without accepting data from the event', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    stop = watchRefresh(refresh, 0);
    await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new StorageEvent('storage', { key: 'strasdrive:refresh', newValue: 'hint' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
