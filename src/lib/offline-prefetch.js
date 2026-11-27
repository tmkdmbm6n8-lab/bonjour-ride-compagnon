import { apiFetch } from './archive-fetch';

let prefetched = false;

const DRIVER_PAGES = [
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
];

let screensLoaded = false;

/**
 * Loads the code of every driver tab into memory right away. Without it, a tab
 * opened for the first time in airplane mode cannot load its screen and the
 * router reloads the whole page, which shows the iPhone's offline screen.
 */
async function preloadDriverScreens(router) {
  if (screensLoaded || !router) return;
  screensLoaded = true;
  for (const to of DRIVER_PAGES) {
    try {
      const route = router.routesByPath?.[to];
      if (route) await router.loadRouteChunk(route);
    } catch {
      screensLoaded = false;
    }
  }
}

export async function prefetchDriverAssets(router) {
  if (typeof window === 'undefined') return;
  await preloadDriverScreens(router);
  if (prefetched) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  prefetched = true;

  // 1. Précharger toutes les données du compte et des onglets dans le téléphone
  for (const endpoint of DRIVER_DATA_ENDPOINTS) {
    try {
      await apiFetch(endpoint);
    } catch {
      // Ignorer si un endpoint échoue temporairement
    }
  }

  // 2. Précharger toutes les pages HTML dans le cache hors-ligne
  for (const page of DRIVER_PAGES) {
    try {
      await fetch(page, { credentials: 'same-origin' });
    } catch {
      // Ignorer si hors connexion
    }
  }
}
