// Offline mode: successful account reads are kept on the phone so every page
// opens without network, and settings changed offline wait here until the
// connection is back. Both are erased on sign-out; the queue empties once sent.
const READ_PREFIX = 'sd-offline-read:';
const WRITE_KEY = 'sd-offline-settings';
// Only settings may wait offline; money, offers and ride acceptance always need the server.
export const QUEUEABLE_SETTINGS = ['/api/drivers/me/preferences', '/api/drivers/me/classes'];
const NEVER_CACHED = /^\/api\/(geo|maps|auth|public|rides\/estimate)/;

function store() { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }

export function rememberRead(path, data) {
  const s = store(); if (!s || NEVER_CACHED.test(path)) return;
  try { s.setItem(READ_PREFIX + path, JSON.stringify({ at: Date.now(), data })); } catch { /* storage full: skip */ }
}

export function recallRead(path) {
  const s = store(); if (!s) return undefined;
  try { const v = JSON.parse(s.getItem(READ_PREFIX + path) || 'null'); return v ? v.data : undefined; } catch { return undefined; }
}

export function readSettingsQueue() {
  const s = store(); if (!s) return [];
  try { const v = JSON.parse(s.getItem(WRITE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

function writeSettingsQueue(items) {
  const s = store(); if (!s) return;
  if (items.length) s.setItem(WRITE_KEY, JSON.stringify(items)); else s.removeItem(WRITE_KEY);
}

/** Keeps the latest change per setting; trip preferences are merged so no earlier toggle is lost. */
export function queueSetting(path, method, body) {
  if (!QUEUEABLE_SETTINGS.includes(path)) return false;
  const items = readSettingsQueue();
  const prev = items.find((i) => i.path === path);
  let merged = body || {};
  if (prev && prev.body?.tripPrefs && merged.tripPrefs) merged = { ...merged, tripPrefs: { ...prev.body.tripPrefs, ...merged.tripPrefs } };
  writeSettingsQueue([...items.filter((i) => i.path !== path), { path, method, body: merged, at: Date.now() }]);
  // Reflect the change in the saved account so the screen shows it immediately.
  const me = recallRead('/api/drivers/me');
  if (me && typeof me === 'object') {
    const d = me.driver || me;
    if (merged.tripPrefs) d.tripPrefs = { ...(d.tripPrefs || {}), ...merged.tripPrefs };
    if (merged.acceptsClasses) d.acceptsClasses = merged.acceptsClasses;
    rememberRead('/api/drivers/me', me);
  }
  return true;
}

/** Sends waiting settings in order; stops at the first network failure, drops server refusals. */
export async function flushSettings(send, isNetworkFailure) {
  for (const item of readSettingsQueue()) {
    try { await send(item); } catch (e) { if (isNetworkFailure(e)) return; }
    writeSettingsQueue(readSettingsQueue().filter((i) => i.path !== item.path || i.at !== item.at));
  }
}

export function clearOfflineData() {
  const s = store(); if (!s) return;
  for (let i = s.length - 1; i >= 0; i--) { const k = s.key(i); if (k && (k.startsWith(READ_PREFIX) || k === WRITE_KEY || k === 'sd-offline-ride-actions')) s.removeItem(k); }
}
