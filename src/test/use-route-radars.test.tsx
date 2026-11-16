import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import useRouteRadars from '@/hooks/useRouteRadars';
import { apiFetch } from '@/lib/archive-fetch';
import { routeCameras } from '@/lib/vtc-driver-cameras.server';

vi.mock('@/lib/archive-fetch', () => ({ apiFetch: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('route radar counter', () => {
  const geometry = [[7, 48], [7.01, 48], [7.02, 48]];
  it('loads the full route once and reduces the count with GPS movement', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify({ available: true,
      cameras: [{ id: 'a', kind: 'radar', lng: 7.005, lat: 48 }, { id: 'b', kind: 'radar', lng: 7.015, lat: 48 }] })));
    const { result, rerender } = renderHook(({ lng }) => useRouteRadars('ride', 'in_progress', geometry, { lng, lat: 48 }), { initialProps: { lng: 7 } });
    await waitFor(() => expect(result.current.count).toBe(2));
    expect(apiFetch).toHaveBeenCalledWith('/api/rides/ride/radars');
    rerender({ lng: 7.0051 });
    await waitFor(() => expect(result.current.count).toBe(1));
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
  it('does not present unavailable data as zero', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify({ available: false, cameras: [] })));
    const { result } = renderHook(() => useRouteRadars('ride', 'in_progress', geometry, { lng: 7, lat: 48 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.count).toBeNull();
  });
  it('does not request radars without an active road route', () => {
    renderHook(() => useRouteRadars('ride', 'arrived', undefined, null));
    expect(apiFetch).not.toHaveBeenCalled();
  });
  it('loads official radars for long French trips beyond the map query limit', async () => {
    const result = await routeCameras([[2.35, 48.85], [7.75, 48.58]]);
    expect(result.available).toBe(true);
    expect(result.cameras.length).toBeGreaterThan(0);
  });
});
