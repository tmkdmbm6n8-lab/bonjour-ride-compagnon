// Driver turn-by-turn: external GPS apps (Google Maps / Waze). In-app legs come from the server (see vtc-routing.js).

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
  const w = window.open(url, '_blank');
  if (!w) return false;
  try { w.opener = null; } catch { /* cross-origin */ }
  return true;
}
