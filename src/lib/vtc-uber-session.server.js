// Session metadata only: never expose the cookie or JWT to the browser.
export function inspectUberSession(cookieHeader, now = Date.now()) {
  if (!cookieHeader || typeof cookieHeader !== "string") return { status: "missing", expiresAt: null, remainingSeconds: null };
  const match = cookieHeader.match(/(?:^|;\s*)jwt-session=([^;]+)/i);
  if (!match) return { status: "unknown", expiresAt: null, remainingSeconds: null };
  try {
    const token = decodeURIComponent(match[1]);
    const parts = token.split(".");
    if (parts.length !== 3) return { status: "unknown", expiresAt: null, remainingSeconds: null };
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    if (!Number.isFinite(decoded.exp) || decoded.exp <= 0) return { status: "unknown", expiresAt: null, remainingSeconds: null };
    const expiresMs = decoded.exp * 1000;
    const remainingSeconds = Math.max(0, Math.floor((expiresMs - now) / 1000));
    return {
      status: expiresMs <= now ? "expired" : remainingSeconds <= 7200 ? "expiring_soon" : "valid_until",
      expiresAt: new Date(expiresMs).toISOString(),
      remainingSeconds,
    };
  } catch {
    return { status: "unknown", expiresAt: null, remainingSeconds: null };
  }
}
