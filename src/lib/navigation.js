// Driver turn-by-turn: external GPS apps (Google Maps / Waze) and keyless OSRM legs for the in-app map.

export const NAV_APPS = { google: 'Google Maps', waze: 'Waze' };
const APP_KEY = 'strasdrive.navApp';
const AUTO_KEY = 'strasdrive.navAuto';

/** Deep link that opens the chosen GPS app in driving navigation to `dest` ({lat,lng}). */
export function navigationUrl(app, dest) {
  const lat = Number(dest?.lat), lng = Number(dest?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (app === 'waze') return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`;
}

export function getNavApp() {
  try { return localStorage.getItem(APP_KEY) === 'waze' ? 'waze' : 'google'; } catch { return 'google'; }
}
export function setNavApp(app) { try { localStorage.setItem(APP_KEY, app === 'waze' ? 'waze' : 'google'); } catch { /* private mode */ } }
export function getNavAuto() { try { return localStorage.getItem(AUTO_KEY) !== '0'; } catch { return true; } }
export function setNavAuto(on) { try { localStorage.setItem(AUTO_KEY, on ? '1' : '0'); } catch { /* private mode */ } }

/** Opens the GPS app; returns false when the browser blocked it (the driver then taps the button). */
export function openNavigation(app, dest) {
  const url = navigationUrl(app, dest);
  if (!url) return false;
  const w = window.open(url, '_blank', 'noopener');
  return Boolean(w) || w === null ? Boolean(w) : true;
}

/** Driving leg from → to via the public OSRM server (no key). Returns [[lng,lat],…] or null. */
export async function fetchLegGeometry(from, to, signal) {
  if (!from || !to) return null;
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
      { signal }
    );
    if (!res.ok) return null;
    const j = await res.json();
    return j.routes?.[0]?.geometry?.coordinates || null;
  } catch {
    return null;
  }
}
