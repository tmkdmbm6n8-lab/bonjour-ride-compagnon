import { Capacitor, registerPlugin } from '@capacitor/core';

let legacyActivity;
let queue = Promise.resolve();
let expiryTimer = null;
let disabled = false;
let nativeOffers;

function nativeOfferPlugin() {
  if (!supported() || !Capacitor.isPluginAvailable('StrasDriveOffers')) return null;
  nativeOffers ||= registerPlugin('StrasDriveOffers');
  return nativeOffers;
}

export async function configureNativeOfferTokens(url) {
  const plugin = nativeOfferPlugin();
  if (plugin) await plugin.configure({ url });
}

/** Online flag for the native Dynamic Island arrow; older iPhone builds without setOnline ignore it. */
export async function setNativeOnlineIndicator(online) {
  try {
    const plugin = nativeOfferPlugin();
    if (plugin) await plugin.setOnline({ online: Boolean(online) });
  } catch { /* the arrow is optional */ }
}

export async function clearNativeOfferTokens() {
  const plugin = nativeOfferPlugin();
  await setNativeOnlineIndicator(false);
  if (plugin) await plugin.clear();
}

function supported() {
  return !disabled && Capacitor.getPlatform() === 'ios';
}
async function offerPlugin() {
  if (!supported() || !Capacitor.isPluginAvailable('LiveActivity')) return null;
  const { LiveActivity } = await import('capacitor-live-activity');
  return LiveActivity;
}

export async function reconcileOfferActivities() {
  const native = nativeOfferPlugin();
  if (native) { await native.reconcile(); return; }
  const plugin = await offerPlugin();
  if (!plugin) return;
  const { items = [] } = await plugin.listActivities();
  for (const item of items) {
    const current = await plugin.getCurrentActivity({ id: item.id });
    const values = current?.values || {};
    // Remove obsolete local demo widgets, or expired server offers; never end a live offer on launch.
    const deadline = Number(values.expiresAt) * 1000;
    if (values.type !== 'driver_offer' || !Number.isFinite(deadline) || deadline <= Date.now()) {
      await plugin.endActivity({ id: item.id, contentState: {}, dismissalPolicy: 'immediate' });
    }
  }
}
function enqueue(action) {
  // Keep start, update and end in order; failure must never block a ride.
  queue = queue.catch(() => {}).then(action).catch(() => {});
  return queue;
}
function clearExpiry() {
  if (expiryTimer !== null) clearTimeout(expiryTimer);
  expiryTimer = null;
}
export function syncLiveActivity(payload) {
  if (!supported() || !payload) return Promise.resolve();
  clearExpiry();
  if (payload.kind === 'driver_offer') {
    const delay = payload.expiresAt - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) return stopLiveActivity('driver_offer');
    expiryTimer = setTimeout(() => { expiryTimer = null; void stopLiveActivity('driver_offer'); }, Math.min(delay, 2147483647));
  }
  if (payload.kind === 'driver_offer') return enqueue(async () => {
    const plugin = await offerPlugin();
    if (!plugin) return;
    const { items = [] } = await plugin.listActivities();
    // Remote start is the only creator: foreground updates never create a second activity.
    if (!items.some((item) => item.id === payload.reference)) return;
    const title = Number.isFinite(payload.amountCents) ? `${(payload.amountCents / 100).toFixed(2).replace('.', ',')} €` : 'Nouvelle course';
    await plugin.updateActivity({ id: payload.reference, contentState: { title, earnings: title, status: 'Nouvelle course', message: 'Nouvelle course disponible', type: 'driver_offer', expiresAt: String(Math.floor(payload.expiresAt / 1000)) } });
  });
  if (!Capacitor.isPluginAvailable('RideLiveActivity')) return Promise.resolve();
  legacyActivity ||= registerPlugin('RideLiveActivity');
  return enqueue(() => legacyActivity.sync(payload));
}
export function stopLiveActivity(kind, reference) {
  if (!supported()) return Promise.resolve();
  if (!kind || kind === 'driver_offer') clearExpiry();
  return enqueue(async () => {
    if (!kind || kind === 'driver_offer') {
      const native = nativeOfferPlugin();
      if (native) {
        await native.endOffers(reference ? { id: reference } : {});
      } else {
        const plugin = await offerPlugin();
        if (plugin) {
          const { items = [] } = await plugin.listActivities();
          for (const item of items) {
            if (!reference || item.id === reference) await plugin.endActivity({ id: item.id, contentState: {}, dismissalPolicy: 'immediate' });
          }
        }
      }
    }
    if (Capacitor.isPluginAvailable('RideLiveActivity')) {
      legacyActivity ||= registerPlugin('RideLiveActivity');
      await legacyActivity.stop(kind ? { kind } : {});
    }
  });
}
export function stopLiveActivitiesForSignOut() {
  const result = stopLiveActivity();
  void result.finally(() => { disabled = true; });
  return result;
}
