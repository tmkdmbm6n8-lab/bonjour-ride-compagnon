import { fareForDriver } from "./driver-ride-fare.server";
import { favoriteDriverId } from "./private-clients.server";
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
    const { data: rows, error } = await admin.from("push_tokens").select("token,user_id").in("user_id", ids);
    if (error || !rows?.length) return;
    const headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
      "Content-Type": "application/json",
    };
    const message = buildOfferMessage(ride);
    const favorite = ride.is_test ? null : await favoriteDriverId(admin, ride.rider_id);
    const privateMessage = rows.some((row) => favorite && row.user_id === favorite)
      ? buildOfferMessage({
          ...ride,
          fare: await fareForDriver(admin, ride, favorite).catch(() => null),
        })
      : message;
    const results = await Promise.all(rows.map((row) =>
      sendOne(row.token, row.user_id === favorite ? privateMessage : message, headers)
        .then((result) => ({ ...result, token: row.token }))
    ));
    const stale = results.filter((x) => x.stale).map((x) => x.token);
    if (stale.length) await admin.from("push_tokens").delete().in("token", stale);
  } catch (e) {
    console.error("pushRideOffer:", e?.message || e);
  }
}

/** Admin and driver notifications share the existing managed Firebase connector. */
export async function pushUsers(admin, userIds, message) {
  const ids = [...new Set(userIds || [])];
  const key = process.env.LOVABLE_API_KEY, connection = process.env.FIREBASE_MESSAGING_API_KEY;
  if (!ids.length || !key || !connection) return false;
  const { data: tokens, error } = await admin.from('push_tokens').select('token').in('user_id', ids);
  if (error || !tokens?.length) return false;
  const headers = { Authorization: `Bearer ${key}`, 'X-Connection-Api-Key': connection, 'Content-Type': 'application/json' };
  const results = await Promise.all(tokens.map(async (row) => ({ token: row.token, ...await sendOne(row.token, message, headers) })));
  const stale = results.filter((row) => row.stale).map((row) => row.token);
  if (stale.length) await admin.from('push_tokens').delete().in('token', stale);
  return results.some((row) => row.ok);
}
