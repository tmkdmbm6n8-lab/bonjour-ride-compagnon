import { apiFetch } from './archive-fetch';
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
  '/api/rides?page=1&limit=15&view=rider',
];

const done = new Set();

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
  if (!done.has(key + ':screens') && (await preloadScreens(router, pages))) done.add(key + ':screens');
  if (done.has(key + ':data') || navigator.onLine === false) return;
  done.add(key + ':data');
  // Reads are kept on the phone by apiFetch, so each screen shows them offline.
  for (const endpoint of endpoints) {
    try { await apiFetch(endpoint); } catch { /* temporary failure: ignored */ }
  }
  // Pages saved for a cold start in airplane mode (app fully closed).
  await warmOfflinePages(['/', ...pages]);
}

export function prefetchDriverAssets(router) {
  return prefetchSpace('driver', router, DRIVER_PAGES, DRIVER_DATA_ENDPOINTS);
}

export function prefetchRiderAssets(router) {
  return prefetchSpace('rider', router, RIDER_PAGES, RIDER_DATA_ENDPOINTS);
}
