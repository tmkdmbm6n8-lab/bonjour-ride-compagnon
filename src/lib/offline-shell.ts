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
  void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
}
