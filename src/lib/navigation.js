// Driver turn-by-turn: external GPS apps (Google Maps / Waze). In-app legs come from the server (see vtc-routing.js).

export const NAV_APPS = { apple: "Plans (Apple)", google: "Google Maps", waze: "Waze" };
const APP_KEY = "strasdrive.navApp";
const AUTO_KEY = "strasdrive.navAuto";

/** Deep link that opens the chosen GPS app in driving navigation to `dest` ({lat,lng}). */
export function navigationUrl(app, dest) {
  const lat = Number(dest?.lat),
    lng = Number(dest?.lng);
  if (
    dest?.lat == null ||
    dest?.lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return null;
  if (app === "apple") return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  if (app === "waze") return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`;
}

export function getNavApp() {
  try {
    const app = localStorage.getItem(APP_KEY);
    return Object.hasOwn(NAV_APPS, app) ? app : "google";
  } catch {
    return "google";
  }
}
export function setNavApp(app) {
  try {
    localStorage.setItem(APP_KEY, Object.hasOwn(NAV_APPS, app) ? app : "google");
  } catch {
    /* private mode */
  }
}
export function getNavAuto() {
  try {
    return localStorage.getItem(AUTO_KEY) !== "0";
  } catch {
    return true;
  }
}
export function setNavAuto(on) {
  try {
    localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  } catch {
    /* private mode */
  }
}

/** Dispatch a normal same-tab link, so iOS can hand it to the installed GPS app.
 * A null window.open result does not indicate failure for mobile app handoffs.
 * True means the link was dispatched, not confirmation that an app is installed.
 */
export function openNavigation(app, dest) {
  const url = navigationUrl(app, dest);
  if (!url) return false;
  const link = document.createElement("a");
  link.href = url;
  link.target = "_self";
  link.hidden = true;
  try {
    document.body.appendChild(link);
    link.click();
    return true;
  } catch {
    return false;
  } finally {
    link.remove();
  }
}
