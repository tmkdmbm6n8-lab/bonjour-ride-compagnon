// Sends ride-offer notifications to drivers' phones through Firebase Cloud Messaging (connector gateway).
import { buildOfferMessage, isStaleTokenError } from "./vtc-push";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const SEND_TIMEOUT_MS = 4000;

async function sendOne(token, message, headers) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: { ...message, token } }),
      signal: ctrl.signal,
    });
    if (res.ok) return { ok: true };
    const text = await res.text();
    console.error(`Push send failed [${res.status}]: ${text}`);
    return { ok: false, stale: isStaleTokenError(res.status, text) };
  } catch (e) {
    console.error("Push send error:", e?.message || e);
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Never throws: a failed notification must not block dispatch. */
export async function pushRideOffer(admin, ride, userIds) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return;
    const lovableKey = process.env.LOVABLE_API_KEY,
      connKey = process.env.FIREBASE_MESSAGING_API_KEY;
    if (!lovableKey || !connKey) return;
    const { data: rows, error } = await admin.from("push_tokens").select("token").in("user_id", ids);
    if (error || !rows?.length) return;
    const headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
      "Content-Type": "application/json",
    };
    const message = buildOfferMessage(ride);
    const results = await Promise.all(rows.map((r) => sendOne(r.token, message, headers).then((x) => ({ ...x, token: r.token }))));
    const stale = results.filter((x) => x.stale).map((x) => x.token);
    if (stale.length) await admin.from("push_tokens").delete().in("token", stale);
  } catch (e) {
    console.error("pushRideOffer:", e?.message || e);
  }
}
