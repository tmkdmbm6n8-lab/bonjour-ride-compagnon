// Ride actions made without network are kept on the phone, replayed in order
// once the connection is back, then erased. Only these actions can wait.
export const QUEUEABLE_ACTIONS = ['arrive', 'start', 'complete'];
const KEY = 'sd-offline-ride-actions';
const memory = { items: [] };

function storage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export function readQueue() {
  const s = storage();
  if (!s) return memory.items;
  try { const v = JSON.parse(s.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

function writeQueue(items) {
  const s = storage();
  if (!s) { memory.items = items; return; }
  if (items.length) s.setItem(KEY, JSON.stringify(items)); else s.removeItem(KEY);
}

export function isNetworkFailure(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true;
  const msg = String(error?.message || error || '').toLowerCase();
  return /network|fetch|failed to fetch|offline|load failed|abort|timeout/i.test(msg);
}

export function enqueue(rideId, action, body, at = Date.now()) {
  if (!QUEUEABLE_ACTIONS.includes(action)) return false;
  const items = readQueue();
  if (items.some((i) => i.rideId === rideId && i.action === action)) return true;
  items.push({ id: `${rideId}:${action}`, rideId, action, body: body || null, at });
  writeQueue(items);
  return true;
}

/** Replays queued actions in order. Stops on network failure (kept for later); server refusals are dropped. */
export async function flushQueue(send) {
  const done = [];
  for (const item of readQueue()) {
    try {
      const result = await send(item);
      done.push({ item, ok: true, result });
    } catch (error) {
      if (isNetworkFailure(error)) break;
      done.push({ item, ok: false, error });
    }
    writeQueue(readQueue().filter((i) => i.id !== item.id));
  }
  return done;
}

export const OPTIMISTIC_STATUS = { arrive: 'arrived', start: 'in_progress' };
