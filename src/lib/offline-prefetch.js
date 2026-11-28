import { apiFetch } from './archive-fetch';
import { parisDay } from './vtc-dates';
import { recallRead } from './offline-cache';
import { warmOfflinePages } from './offline-shell';

// Every screen of each space, loaded in the background on the first connected
// opening so the whole app keeps working in airplane mode afterwards.
export const DRIVER_PAGES = [
  '/driver/dashboard',
  '/driver/reservations',
  '/driver/discover',
  '/driver/earnings',
  '/driver/inbox',
  '/driver/menu',
  '/driver/preferences',
  '/driver/profile',
  '/driver/private-clients',
  '/driver/trips',
  '/driver/wallet',
];

const DRIVER_DATA_ENDPOINTS = [
  '/api/drivers/me',
  '/api/drivers/me/gold',
  '/api/drivers/me/accepted-reservations',
  '/api/drivers/me/preferences',
  '/api/drivers/me/classes',
  '/api/drivers/me/inbox?page=1',
  '/api/users/me?view=driver',
  '/api/rides?page=1&limit=15',
  '/api/users/me',
  '/api/users/me/live',
  '/api/wallet',
];

export const RIDER_PAGES = [
  '/dashboard',
  '/favorite',
  '/transport',
  '/recurring',
  '/wallet',
  '/profile',
  '/rides',
];

const RIDER_DATA_ENDPOINTS = [
  '/api/users/me',
  '/api/riders/me/favorite',
  '/api/wallet',
  '/api/rider/cards',
  '/api/rides/active',
  '/api/rides/active?view=rider',
  '/api/riders/me/scheduled-requests',
  '/api/rides?page=1&limit=15&view=rider',
];

const done = new Set();
const pending = new Map();
const refreshed = new Map();

/**
 * Loads the code of every tab into memory right away. Without it, a tab
 * opened for the first time in airplane mode cannot load its screen and the
 * router reloads the whole page, which shows the iPhone's offline screen.
 */
async function preloadScreens(router, pages) {
  if (!router) return true;
  let ok = true;
  for (const to of pages) {
    try {
      const route = router.routesByPath?.[to];
      if (route) await router.loadRouteChunk(route);
    } catch {
      ok = false;
    }
  }
  return ok;
}

async function prefetchSpace(key, router, pages, endpoints) {
  if (typeof window === 'undefined') return;
  if (!done.has(key + ':screens')) void preloadScreens(router, pages).then(ok => { if (ok) done.add(key + ':screens'); });
  if (navigator.onLine === false || pending.has(key)) return;
  const task = (async () => {
    const reads = [...endpoints];
    if (key === 'driver') {
      reads.unshift('/api/drivers/me/earnings?day=' + parisDay());
      try {
        const response = await apiFetch('/api/drivers/me/gold');
        const payload = await response.json();
        if (response.ok && payload.gold?.active) {
          reads.unshift('/api/drivers/me/discover?day=' + parisDay(), '/api/drivers/me/private-clients');
        }
      } catch { /* retry on next navigation */ }
    }
    if (key === 'rider') reads.unshift('/api/riders/me/transport-board?day=' + parisDay());
    const due = [...new Set(reads)].filter(path => recallRead(path) === undefined || Date.now() - (refreshed.get(path) || 0) > 60000);
    // Limit parallel requests to avoid starving the active screen.
    for (let i = 0; i < due.length; i += 3) {
      await Promise.all(due.slice(i, i + 3).map(async path => {
        try { const response = await apiFetch(path); if (response.ok) refreshed.set(path, Date.now()); } catch { /* retry later */ }
      }));
    }
    if (!done.has(key + ':shell')) {
      await warmOfflinePages(['/', ...pages]);
      done.add(key + ':shell');
    }
  })();
  pending.set(key, task);
  try { await task; } finally { pending.delete(key); }
}

export function prefetchDriverAssets(router) {
  return prefetchSpace('driver', router, DRIVER_PAGES, DRIVER_DATA_ENDPOINTS);
}

export function prefetchRiderAssets(router) {
  return prefetchSpace('rider', router, RIDER_PAGES, RIDER_DATA_ENDPOINTS);
}

export function prefetchAdminScreens(router, pages) {
  return prefetchSpace('admin', router, [...new Set(pages)], ['/api/users/me']);
}
