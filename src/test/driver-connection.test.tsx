import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {getDriverLocation} from '@/lib/driver-connection';
import useDriverState from '@/hooks/useDriverState';

const fixtures = vi.hoisted(() => ({fetch: vi.fn()}));
vi.mock('@/lib/archive-fetch', () => ({apiFetch: (...args: any[]) => fixtures.fetch(...args)}));
vi.mock('@/context/SocketProvider', () => ({useSocket: () => ({socket: null, isConnected: true})}));
beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, 'isSecureContext', {value: true, configurable: true});
  fixtures.fetch.mockImplementation(async (path: string) => ({ok: true, json: async () => path === '/api/drivers/me' ? {driver: {isOnline: false}} : {ride: null}}));
});
afterEach(() => {cleanup(); vi.useRealTimers(); vi.clearAllMocks();});
function gps(getCurrentPosition: any) {
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {getCurrentPosition, watchPosition: vi.fn(), clearWatch: vi.fn()}});
}

it('releases the GO button when iOS never answers the GPS request', async () => {
  gps(vi.fn());
  const {result} = renderHook(() => useDriverState());
  await act(async () => {});
  let operation: Promise<any>;
  act(() => {operation = result.current.goOnline().catch(error => error);});
  expect(result.current.connectionStage).toBe('Localisation…');
  await act(async () => {await vi.advanceTimersByTimeAsync(16000);});
  expect((await operation!).message).toMatch(/localisation ne répond pas/);
  expect(result.current.busy).toBe(false);
  expect(result.current.online).toBe(false);
  expect(fixtures.fetch.mock.calls.some(([path]) => path === '/api/drivers/me/status')).toBe(false);
});

it('retries a failed precise GPS fix with the standard location provider', async () => {
  const locate = vi.fn().mockImplementationOnce((_ok, fail) => fail({code: 3})).mockImplementationOnce(ok => ok({coords: {latitude: 48.58, longitude: 7.73}}));
  gps(locate);
  await expect(getDriverLocation()).resolves.toEqual({lat: 48.58, lng: 7.73});
  expect(locate.mock.calls[1][2].enableHighAccuracy).toBe(false);
});

it('explains a denied location permission without retrying it', async () => {
  const locate = vi.fn((_ok, fail) => fail({code: 1}));
  gps(locate);
  await expect(getDriverLocation()).rejects.toThrow(/Localisation refusée/);
  expect(locate).toHaveBeenCalledTimes(1);
});

it('releases GO when the status server never responds, without claiming to be online', async () => {
  gps(vi.fn(ok => ok({coords: {latitude: 48.58, longitude: 7.73}})));
  const original = fixtures.fetch.getMockImplementation()!;
  fixtures.fetch.mockImplementation((path: string) => path.endsWith('/status') ? new Promise(() => {}) : original(path));
  const {result} = renderHook(() => useDriverState());
  await act(async () => {});
  let operation: Promise<any>;
  await act(async () => {operation = result.current.goOnline().catch(error => error);});
  expect(result.current.connectionStage).toBe('Connexion…');
  await act(async () => {await vi.advanceTimersByTimeAsync(20000);});
  expect((await operation!).message).toMatch(/serveur ne répond pas/);
  expect(result.current.busy).toBe(false);
  expect(result.current.online).toBe(false);
});
