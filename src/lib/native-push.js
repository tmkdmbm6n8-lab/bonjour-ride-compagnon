// Ride-offer notifications in the native iOS/Android app (Capacitor). No-op in a browser.
import { apiFetch } from "./archive-fetch";
import { OFFER_CHANNEL_ID, OFFER_PATH } from "./vtc-push";
import { publishRefresh } from "./live-refresh";
import { validLiveActivityDeviceId, validLiveActivityToken } from "./live-activity-offers";

const TOKEN_KEY = "sd_push_token";
const LIVE_ACTIVITY_TOKEN_KEY = "sd_live_activity_token";
const LIVE_ACTIVITY_DEVICE_KEY = "sd_live_activity_device";
const NATIVE_UPDATE_TOKEN_URL = "https://strasdrive.fr/api/public/native/live-activity-token";

let started = false;
let liveActivityListener;
let liveActivityUpdateListener;
let liveActivityRegistration = Promise.resolve();

function isNativeApp() {
  return typeof window !== "undefined" && Boolean(window.Capacitor?.isNativePlatform?.());
}

function liveActivityDeviceId() {
  let id = null;
  try { id = validLiveActivityDeviceId(localStorage.getItem(LIVE_ACTIVITY_DEVICE_KEY)); } catch {}
  if (id) return id;
  id = globalThis.crypto?.randomUUID?.() || `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 18)}`;
  try { localStorage.setItem(LIVE_ACTIVITY_DEVICE_KEY, id); } catch {}
  return id;
}

function queueLiveActivityRegistration(action) {
  liveActivityRegistration = liveActivityRegistration.catch(() => {}).then(action).catch((error) => {
    console.warn("Enregistrement Live Activity indisponible", error?.message || error);
  });
  return liveActivityRegistration;
}

function registerStartToken(token) {
  const validToken = validLiveActivityToken(token);
  if (!started || !validToken) return Promise.resolve();
  return queueLiveActivityRegistration(async () => {
    if (!started) return;
    try { localStorage.setItem(LIVE_ACTIVITY_TOKEN_KEY, validToken); } catch {}
    const response = await apiFetch("/api/notifications/live-activity-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: validToken, deviceId: liveActivityDeviceId() }),
    });
    if (!response.ok) throw new Error("Enregistrement du jeton de démarrage refusé");
  });
}

function registerUpdateToken({ id, activityId, token }) {
  const validToken = validLiveActivityToken(token);
  if (!started || !id || !activityId || !validToken) return Promise.resolve();
  return queueLiveActivityRegistration(async () => {
    if (!started) return;
    const response = await apiFetch("/api/notifications/live-activity-update-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rideId: id, activityId, token: validToken, deviceId: liveActivityDeviceId() }),
    });
    if (!response.ok) throw new Error("Enregistrement du jeton de fermeture refusé");
  });
}

/** Registers this phone for ride offers; call from driver pages only. */
export async function registerDriverPush({ audience = "driver" } = {}) {
  if (started || !isNativeApp()) return;
  started = true;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const platform = window.Capacitor?.getPlatform?.();
    // Android-only notification channels; iOS uses APNs notification categories.
    if (platform === "android") await PushNotifications.createChannel({
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
      try { localStorage.setItem(TOKEN_KEY, value); } catch {}
      await apiFetch("/api/notifications/push-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value, platform: platform === "ios" ? "ios" : "android" }),
      });
    });
    await PushNotifications.addListener("registrationError", (e) => console.error("Push registration:", e?.error));
    await PushNotifications.addListener("pushNotificationReceived", ({ data }) => {
      if (data?.type === "ride_offer") publishRefresh();
    });
    // In an existing driver tab, reveal the shared offer without losing that page.
    await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      if (notification?.data?.type === "ride_offer" && /^\/driver(?:\/|$)/.test(window.location.pathname)) {
        publishRefresh();
      }
      const data = notification?.data || {};
      const path = data.path || (data.rideId ? `${OFFER_PATH}?offer=${encodeURIComponent(data.rideId)}` : OFFER_PATH);
      // Reject protocol-relative URLs (//host), backslashes and control characters from push payloads.
      if (typeof path === "string" && /^\/(?!\/)[^\\\x00-\x1F\x7F]*$/.test(path) && window.location.pathname + window.location.search !== path) window.location.assign(path);
    });
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale")
      perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      started = false; // Allow another attempt if the user changes notification permissions.
      return;
    }
    await PushNotifications.register();

    if (audience !== "driver" || platform !== "ios") return;
    const { LiveActivity } = await import("capacitor-live-activity");
    const deviceId = liveActivityDeviceId();

    liveActivityListener = await LiveActivity.addListener("liveActivityPushToStartToken", ({ token }) => {
      void registerStartToken(token);
    });
    liveActivityUpdateListener = await LiveActivity.addListener("liveActivityPushToken", (event) => {
      void registerUpdateToken(event);
    });

    // The native plugin persists this URL and can register a token without the WebView.
    if (typeof LiveActivity.setUpdateTokenEndpoint === "function") {
      await LiveActivity.setUpdateTokenEndpoint({
        url: `${NATIVE_UPDATE_TOKEN_URL}?device=${encodeURIComponent(deviceId)}`,
      });
    }
    await LiveActivity.observePushToStartToken();

    // Re-associate a previously received token after sign-in/account change.
    let savedStartToken = null;
    try { savedStartToken = localStorage.getItem(LIVE_ACTIVITY_TOKEN_KEY); } catch {}
    if (savedStartToken) void registerStartToken(savedStartToken);

    // iOS may have cached per-activity tokens while StrasDrive was not running.
    if (typeof LiveActivity.getActivityPushTokens === "function") {
      const { items = [] } = await LiveActivity.getActivityPushTokens();
      for (const item of items) void registerUpdateToken(item);
    }
  } catch (e) {
    started = false;
    console.error("Push setup:", e?.message || e);
  }
}

/** Stops offers on this phone before signing out, so the next account on it does not get them. */
export async function unregisterDriverPush() {
  if (!isNativeApp()) return;
  started = false;
  const platform = window.Capacitor?.getPlatform?.();

  if (platform === "ios") {
    const listeners = [liveActivityListener, liveActivityUpdateListener];
    liveActivityListener = undefined;
    liveActivityUpdateListener = undefined;
    await liveActivityRegistration;
    for (const listener of listeners) {
      try { await listener?.remove(); } catch {}
    }
    try {
      const token = validLiveActivityToken(localStorage.getItem(LIVE_ACTIVITY_TOKEN_KEY));
      if (token) {
        const response = await apiFetch("/api/notifications/live-activity-token", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, deviceId: liveActivityDeviceId() }),
        });
        if (response.ok) localStorage.removeItem(LIVE_ACTIVITY_TOKEN_KEY);
      }
    } catch { /* A later sign-in will reassign the same device token safely. */ }
  }

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.removeAllListeners();
  } catch { /* sign-out must remain possible without the native plugin */ }
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
