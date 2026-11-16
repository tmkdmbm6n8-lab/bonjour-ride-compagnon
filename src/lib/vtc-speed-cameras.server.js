import { cameraBounds, camerasFromOverpass } from './vtc-speed-cameras';

export function createCameraService(fetcher = fetch, now = Date.now) {
  const cache = new Map();
  const pending = new Map();
  let retryAfter = 0;
  return async function load(value) {
    const bounds = cameraBounds(value);
    const key = bounds.join(',');
    const cached = cache.get(key);
    const fallback = () => ({ cameras: cached?.cameras || [], available: false, stale: Boolean(cached) });
    if (cached && now() - cached.at < 6 * 3600_000) return { cameras: cached.cameras, available: true, stale: false };
    if (pending.has(key)) return pending.get(key);
    if (now() < retryAfter || pending.size >= 2) return fallback();
    const task = (async () => {
      try {
        const [west, south, east, north] = bounds;
        const query = `[out:json][timeout:8];node["highway"="speed_camera"](${south},${west},${north},${east});out body;`;
        const response = await fetcher(process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': 'StrasDrive/1.0 (OSM speed camera map)' },
          body: new URLSearchParams({ data: query }).toString(), signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error('Overpass indisponible');
        const cameras = camerasFromOverpass(await response.json());
        cache.delete(key);
        cache.set(key, { cameras, at: now() });
        while (cache.size > 96) cache.delete(cache.keys().next().value);
        return { cameras, available: true, stale: false };
      } catch {
        retryAfter = now() + 60_000;
        return fallback();
      }
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  };
}

export const speedCameras = createCameraService();
