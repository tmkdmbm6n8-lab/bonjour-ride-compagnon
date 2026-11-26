import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import useDriverState from '@/hooks/useDriverState';
import { apiFetch } from '@/lib/archive-fetch';
const state = vi.hoisted(() => ({ handlers: new Map<string, any>(), now: 10000 }));
vi.mock('@/context/SocketProvider', () => ({ useSocket: () => ({ socket: socket, isConnected: true }) }));
const socket = { on: (event: string, callback: any) => state.handlers.set(event, callback), off: (event: string) => state.handlers.delete(event), emit: vi.fn() };
vi.mock('@/lib/archive-fetch', () => ({ apiFetch: vi.fn(async (path: string) => ({ ok: true, json: async () => path === '/api/drivers/me' ? { driver: { isOnline: false } } : { ride: null } })) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); state.handlers.clear(); });
it('charge le profil chauffeur une seule fois à l’ouverture', async () => {
  vi.mocked(apiFetch).mockClear();
  const { result } = renderHook(() => useDriverState());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(vi.mocked(apiFetch).mock.calls.map(([path]) => path).filter(path => path === '/api/drivers/me')).toHaveLength(1);
});

describe('enrichissement de l’offre avec une arrivée aéroport', () => {
  it('ne relance ni le compte à rebours ni l’offre quand les données aéroport arrivent', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10000);
    const { result } = renderHook(() => useDriverState());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => state.handlers.get('ride:offer')({ rideId: 'ride-1', expiresInSeconds: 60 }));
    expect((result.current.offer as any).receivedAt).toBe(10000);
    now.mockReturnValue(20000);
    act(() => state.handlers.get('ride:offer-updated')({ rideId: 'ride-1', expiresInSeconds: 50, airportReturn: { flightNumber: 'V7 123' } }));
    expect((result.current.offer as any).receivedAt).toBe(10000);
    expect((result.current.offer as any).expiresInSeconds).toBe(60);
    expect((result.current.offer as any).airportReturn.flightNumber).toBe('V7 123');
    act(() => state.handlers.get('ride:offer-updated')({ rideId: 'another-ride', airportReturn: null }));
    expect((result.current.offer as any).airportReturn.flightNumber).toBe('V7 123');
  });
});