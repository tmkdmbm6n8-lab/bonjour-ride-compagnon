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

export async function prefetchDriverAssets() {
  if (prefetched || typeof window === 'undefined') return;
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
