// Seul point d'enregistrement du service worker (démarrage hors réseau).
const PREVIEW_LABEL = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/;

function isRefusedHost(host: string): boolean {
  const label = host.split(".")[0] ?? "";
  if (/\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host)) {
    if (PREVIEW_LABEL.test(label)) return true;
    if (/^project--.+-dev$/.test(label)) return true;
  }
  return [/(^|\.)lovableproject\.com$/, /(^|\.)lovableproject-dev\.com$/, /(^|\.)beta\.lovable\.dev$/].some((r) => r.test(host));
}

async function unregisterAppWorkers() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs.filter((r) => (r.active ?? r.installing ?? r.waiting)?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()),
  );
}

let registration: Promise<ServiceWorkerRegistration | null> = Promise.resolve(null);

/**
 * Saves the given pages in the worker's page cache (the same one the worker
 * fills on navigation), refreshed on every connected opening, so the app can
 * start with the phone in airplane mode on any of them.
 */
export async function warmOfflinePages(paths: string[]) {
  if (typeof window === "undefined" || typeof caches === "undefined") return;
  const reg = await registration.catch(() => null);
  if (!reg) return;
  try {
    const cache = await caches.open(`workbox-runtime-${reg.scope}`);
    for (const path of new Set(paths)) {
      try {
        const res = await fetch(path, { credentials: "same-origin", headers: { Accept: "text/html" } });
        if (res.ok && (res.headers.get("content-type") || "").includes("text/html")) await cache.put(new URL(path, location.origin).href, res);
      } catch { /* offline: keep the saved copy */ }
    }
  } catch { /* cache storage unavailable */ }
}

export function registerOfflineShell() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const host = window.location.hostname.toLowerCase();
  let inFrame = false;
  try { inFrame = window.self !== window.top; } catch { inFrame = true; }
  const off = new URLSearchParams(window.location.search).get("sw") === "off";
  if (!import.meta.env.PROD || inFrame || off || isRefusedHost(host)) {
    void unregisterAppWorkers().catch(() => {});
    return;
  }
  registration = navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then(() => navigator.serviceWorker.ready)
    .catch(() => null);
  void registration.then(async (reg) => {
    if (!reg || navigator.onLine === false) return;
    try {
      const cache = await caches.open(`workbox-runtime-${reg.scope}`);
      if (!(await cache.match(location.pathname))) await cache.add(location.pathname);
    } catch { /* ignored */ }
  });
}
