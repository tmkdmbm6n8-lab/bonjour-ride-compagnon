import { Capacitor, registerPlugin } from '@capacitor/core';

const liveActivity = registerPlugin('RideLiveActivity');
let queue = Promise.resolve();
let expiryTimer = null;
let disabled = false;

function supported() {
  return !disabled && Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('RideLiveActivity');
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
  return enqueue(() => liveActivity.sync(payload));
}
export function stopLiveActivity(kind) {
  if (!supported()) return Promise.resolve();
  if (!kind || kind === 'driver_offer') clearExpiry();
  return enqueue(() => liveActivity.stop(kind ? { kind } : {}));
}
export function stopLiveActivitiesForSignOut() {
  const result = stopLiveActivity();
  disabled = true;
  return result;
}
