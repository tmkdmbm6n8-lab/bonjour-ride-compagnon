// Events are refresh hints only: permissions and data always come from the server.
export const LIVE_REFRESH_EVENT = 'strasdrive:refresh';
const STORAGE_KEY = 'strasdrive:refresh';
export function publishRefresh(crossTab = false) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(LIVE_REFRESH_EVENT));
  if (crossTab) {
    try { localStorage.setItem(STORAGE_KEY, `${Date.now()}:${Math.random()}`); } catch { /* storage unavailable */ }
  }
}

/** One request at a time; visibility/network recovery bypass the normal delay. */
export function watchRefresh(refresh, interval = 5000) {
  let stopped = false, pending = false, queued = false, timer, controller, deadline;
  const run = async (force = false) => {
    if (stopped || document.hidden) return;
    if (pending) { if (force) queued = true; return; }
    clearTimeout(timer);
    pending = true;
    controller = new AbortController();
    deadline = setTimeout(() => controller.abort(), 15000);
    try { await refresh(() => !stopped, controller.signal); } catch { /* retain last confirmed state on network failures */ }
    finally {
      clearTimeout(deadline);
      pending = false;
      if (!stopped) {
        if (queued) { queued = false; void run(); }
        else if (interval) timer = setTimeout(run, interval);
      }
    }
  };
  const wake = () => { void run(true); };
  const storage = (event) => { if (event.key === STORAGE_KEY) wake(); };
  window.addEventListener('focus', wake);
  window.addEventListener('online', wake);
  window.addEventListener(LIVE_REFRESH_EVENT, wake);
  window.addEventListener('storage', storage);
  document.addEventListener('visibilitychange', wake);
  void run();
  return () => {
    stopped = true;
    clearTimeout(deadline);
    controller?.abort();
    clearTimeout(timer);
    window.removeEventListener('focus', wake);
    window.removeEventListener('online', wake);
    window.removeEventListener(LIVE_REFRESH_EVENT, wake);
    window.removeEventListener('storage', storage);
    document.removeEventListener('visibilitychange', wake);
  };
}
