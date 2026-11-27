// Ride-offer notifications in the native iOS/Android app (Capacitor). No-op in a browser.
import { apiFetch } from "./archive-fetch";
import { OFFER_CHANNEL_ID, OFFER_PATH } from "./vtc-push";
import { publishRefresh } from "./live-refresh";

const TOKEN_KEY = "sd_push_token";
const LIVE_ACTIVITY_TOKEN_KEY = "sd_live_activity_token";

let started = false;
let liveActivityListener;
let liveActivityUpdateListener;
let liveActivityRegistration = Promise.resolve();

function isNativeApp() {
  return typeof window !== "undefined" && Boolean(window.Capacitor?.isNativePlatform?.());
}

/** Registers this phone for ride offers; call from driver pages only. */
export async function registerDriverPush({ audience = "driver" } = {}) {
  if (started || !isNativeApp()) return;
  started = true;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const platform = window.Capacitor?.getPlatform?.();

    if (platform === "android") {
      await PushNotifications.createChannel({
        id: OFFER_CHANNEL_ID,
        name: audience === "admin" ? "Alertes StrasDrive" : "Nouvelles courses",
        description: "Alerte quand une course vous est proposÃ©e",
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: "#C9A227",
      }).catch(() => {});
    }

    await PushNotifications.addListener("registration", async ({ value }) => {
      try {
        localStorage.setItem(TOKEN_KEY, value);
      } catch {}

      await apiFetch("/api/notifications/push-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value, platform: platform === "ios" ? "ios" : "android" }),
      });
    });

    await PushNotifications.addListener("registrationError", (error) => {
      console.error("Push registration:", error?.error);
    });

    await PushNotifications.addListener("pushNotificationReceived", ({ data }) => {
      if (data?.type === "ride_offer") publishRefresh();
    });

    await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      if (notification?.data?.type === "ride_offer" && /^\/driver(?:\/|$)/.test(window.location.pathname)) {
        publishRefresh();
      }

      const data = notification?.data || {};
      const path = data.path || (data.rideId ? `${OFFER_PATH}?offer=${encodeURIComponent(data.rideId)}` : OFFER_PATH);

      // Only allow safe, relative paths inside the app.
      if (typeof path === "string" && /^\/(?!\/)[^\\\x00-\x1F\x7F]*$/.test(path) &&
          window.location.pathname + window.location.search !== path) {
        window.location.assign(path);
      }
    });

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      started = false;
      return;
    }

    await PushNotifications.register();

    if (audience !== "driver" || platform !== "ios") return;
    const liveActivity = window.Capacitor?.Plugins?.LiveActivity;
    if (!liveActivity) return;

    try {
      liveActivityListener = await liveActivity.addListener(
        "liveActivityPushToStartToken",
        ({ token }) => {
          if (!started || typeof token !== "string" || !token) return;

          liveActivityRegistration = liveActivityRegistration.then(async () => {
            if (!started) return;
            localStorage.setItem(LIVE_ACTIVITY_TOKEN_KEY, token);

            const response = await apiFetch("/api/notifications/live-activity-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });

            if (!response.ok) throw new Error("Enregistrement refusÃ©");
          }).catch(() => {
            console.warn("Enregistrement Live Activity indisponible");
          });
        },
      );

      liveActivityUpdateListener = await liveActivity.addListener(
        "liveActivityPushToken",
        ({ id, activityId, token }) => {
          if (!started || !id || !activityId || !token) return;

          liveActivityRegistration = liveActivityRegistration.then(async () => {
            if (!started) return;

            const response = await apiFetch("/api/notifications/live-activity-update-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rideId: id, activityId, token }),
            });

            if (!response.ok) throw new Error("Enregistrement refusÃ©");
          }).catch(() => {
            console.warn("Enregistrement du jeton de fermeture indisponible");
          });
        },
      );

      await liveActivity.observePushToStartToken();
    } catch {
      console.warn("Live Activity indisponible sur cet iPhone");
    }
  } catch (error) {
    started = false;
    console.error("Push setup:", error?.message || error);
  }
}

/** Stops offers on this phone before signing out. */
export async function unregisterDriverPush() {
  if (!isNativeApp()) return;
  started = false;

  const listeners = [liveActivityListener, liveActivityUpdateListener];
  liveActivityListener = undefined;
  liveActivityUpdateListener = undefined;

  for (const listener of listeners) {
    try {
      await listener?.remove();
    } catch {
      console.warn("Impossible de retirer un Ã©couteur Live Activity");
    }
  }

  try {
    await liveActivityRegistration;
    const liveToken = localStorage.getItem(LIVE_ACTIVITY_TOKEN_KEY);

    if (liveToken) {
      const response = await apiFetch("/api/notifications/live-activity-token", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: liveToken }),
      });

      if (response.ok) {
        localStorage.removeItem(LIVE_ACTIVITY_TOKEN_KEY);
      } else {
        console.warn("Retrait du jeton Live Activity refusÃ©");
      }
    }
  } catch {
    console.warn("Retrait du jeton Live Activity indisponible");
  }

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.removeAllListeners();
  } catch {}

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
