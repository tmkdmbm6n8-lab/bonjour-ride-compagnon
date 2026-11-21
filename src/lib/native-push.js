// Ride-offer notifications in the native iOS/Android app (Capacitor). No-op in a browser.
import { apiFetch } from "./archive-fetch";
import { OFFER_CHANNEL_ID, OFFER_PATH } from "./vtc-push";

const TOKEN_KEY = "sd_push_token";
let started = false;

function isNativeApp() {
  return typeof window !== "undefined" && Boolean(window.Capacitor?.isNativePlatform?.());
}

/** Registers this phone for ride offers; call from driver pages only. */
export async function registerDriverPush({ audience = "driver" } = {}) {
  if (started || !isNativeApp()) return;
  started = true;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    // Android-only notification channels; iOS uses APNs notification categories.
    if (window.Capacitor?.getPlatform?.() === "android") await PushNotifications.createChannel({
      id: OFFER_CHANNEL_ID,
      name: audience === "admin" ? "Alertes StrasDrive" : "Nouvelles courses",
      description: "Alerte quand une course vous est proposée",
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: "#C9A227",
    }).catch(() => {});
    await PushNotifications.addListener("registration", async ({ value }) => {
      try {
        localStorage.setItem(TOKEN_KEY, value);
      } catch {}
      await apiFetch("/api/notifications/push-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value, platform: window.Capacitor?.getPlatform?.() === "ios" ? "ios" : "android" }),
      });
    });
    await PushNotifications.addListener("registrationError", (e) => console.error("Push registration:", e?.error));
    // Tapping the banner opens the driver home, where the offer is shown.
    await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const path = notification?.data?.path || OFFER_PATH;
      // Reject protocol-relative URLs (//host), backslashes and control characters from push payloads.
      if (typeof path === "string" && /^\/(?!\/)[^\\\x00-\x1F\x7F]*$/.test(path) && window.location.pathname !== path) window.location.assign(path);
    });
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale")
      perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      started = false; // Allow another attempt if the user changes notification permissions.
      return;
    }
    await PushNotifications.register();
  } catch (e) {
    started = false;
    console.error("Push setup:", e?.message || e);
  }
}

/** Stops offers on this phone before signing out, so the next account on it does not get them. */
export async function unregisterDriverPush() {
  if (!isNativeApp()) return;
  let token = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
  if (!token) return;
  await apiFetch("/api/notifications/push-token", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => {});
}
