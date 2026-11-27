import { fareForDriver } from "./driver-ride-fare.server";
import { favoriteDriverId } from "./private-clients.server";
import { buildOfferMessage, isStaleTokenError, isApnsHexToken, APPLE_BUNDLE_ID } from "./vtc-push";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const SEND_TIMEOUT_MS = 4000;

const diagnostics = [];
export function getPushDiagnostics() { return [...diagnostics]; }
function log(entry) { diagnostics.unshift({ timestamp: new Date().toISOString(), ...entry }); if (diagnostics.length > 150) diagnostics.pop(); }
let jwtCache;

async function sendApple(token, message, liveActivity = false) {
  const { APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY, APNS_ENV } = process.env;
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) { log({provider:"apns",outcome:"missing_configuration"}); return {ok:false}; }
  try {
    const now = Math.floor(Date.now()/1000);
    if (!jwtCache || now-jwtCache.time > 2400) {
      const b64 = value => btoa(value).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
      const pem = APNS_PRIVATE_KEY.replace(/\\n/g,"\n").replace(/-----[^-]+-----/g,"").replace(/\s/g,"");
      const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), c=>c.charCodeAt(0)), {name:"ECDSA",namedCurve:"P-256"}, false, ["sign"]);
      const input = b64(JSON.stringify({alg:"ES256",kid:APNS_KEY_ID}))+"."+b64(JSON.stringify({iss:APNS_TEAM_ID,iat:now}));
      const sig = await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,new TextEncoder().encode(input));
      jwtCache={time:now,value:input+"."+b64(String.fromCharCode(...new Uint8Array(sig)))};
    }
    const host = APNS_ENV === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
    const payload = liveActivity
      ? message.apns.payload
      : { ...message.data, aps: { alert: message.notification, sound: "default", ...message.apns?.payload?.aps } };
    // Cloudflare Workers has no node:http2; its fetch speaks HTTP/2 to APNs.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS);
    let response;
    try {
      const res = await fetch("https://" + host + "/3/device/" + token, {
        method: "POST",
        headers: {
          authorization: "bearer " + jwtCache.value,
          "apns-topic": liveActivity ? `${APPLE_BUNDLE_ID}.push-type.liveactivity` : APPLE_BUNDLE_ID,
          "apns-push-type": liveActivity ? "liveactivity" : "alert",
          "apns-priority": "10",
          "apns-expiration": message.apns?.headers?.["apns-expiration"] || "0",
          "content-type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      response = { status: res.status, body: await res.text() };
    } finally { clearTimeout(timer); }
    let reason;
    try { reason = JSON.parse(response.body).reason; } catch {}
    const ok = response.status === 200;
    log({provider:"apns",environment:APNS_ENV || "production",status:response.status,reason,outcome:ok?"success":"failed"});
    console.info("[APNs]", response.status, reason || "accepted");
    return {ok,stale:response.status===410};
  } catch(e) { log({provider:"apns",outcome:"network_or_configuration_error",code:e?.code || e?.name}); console.error("[APNs] transport error", e?.code || e?.name); return {ok:false}; }
}

async function sendOne(token, message, headers) {
  if (isApnsHexToken(token)) return sendApple(token,message);
  if (!headers) return {ok:false};
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

async function startRideOfferLiveActivities(admin, userIds, ride, message) {
  // Laisser dÃ©sactivÃ© jusqu'Ã  ce que la fin d'offre soit branchÃ©e.
  if (process.env.LIVE_ACTIVITY_OFFERS_ENABLED !== "true") return;

  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = Number(message.apns?.headers?.["apns-expiration"]);
  if (!ride.id || !Number.isFinite(expiresAt) || expiresAt <= timestamp) return;

  const { data: devices, error } = await admin
    .from("live_activity_start_tokens")
    .select("token")
    .in("user_id", userIds);
  if (error) throw error;

  const results = await Promise.all((devices ?? []).map(async ({ token }) => ({
    token,
    ...await sendApple(token, {
      apns: {
        headers: { "apns-expiration": String(expiresAt) },
        payload: {
          aps: {
            timestamp,
            event: "start",
            "attributes-type": "GenericAttributes",
            attributes: { id: String(ride.id), staticValues: { type: "driver_offer" } },
            "content-state": { values: { status: "Nouvelle course" } },
            "stale-date": expiresAt,
            alert: { title: "StrasDrive", body: "Nouvelle course disponible" },
          },
        },
      },
    }, true),
  })));

  const expiredTokens = results.filter((result) => result.stale).map(({ token }) => token);
  if (expiredTokens.length) {
    await admin.from("live_activity_start_tokens").delete().in("token", expiredTokens);
  }
}

/** Never throws: a failed notification must not block dispatch. */
export async function pushRideOffer(admin, ride, userIds) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return;
    const lovableKey = process.env.LOVABLE_API_KEY,
      connKey = process.env.FIREBASE_MESSAGING_API_KEY;

    const { data: rows, error } = await admin.from("push_tokens").select("token,user_id").in("user_id", ids);
    if (error || !rows?.length) return;
    const headers = lovableKey && connKey ? {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
      "Content-Type": "application/json",
    } : null;
    const message = buildOfferMessage(ride);
    await startRideOfferLiveActivities(admin, ids, ride, message).catch((error) => {
      console.error("Envoi Live Activity impossible", error?.code || error?.name);
    });
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

export async function endRideOfferLiveActivities(admin, rideId, userId) {
  let query = admin
    .from("live_activity_update_tokens")
    .select("token,user_id")
    .eq("ride_id", String(rideId));

  if (userId !== undefined) query = query.eq("user_id", userId);
  const { data: activities, error } = await query;
  if (error) throw error;

  await Promise.all((activities ?? []).map(async ({ token, user_id: ownerId }) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const result = await sendApple(token, {
      apns: {
        payload: {
          aps: {
            timestamp,
            event: "end",
            "content-state": { values: { status: "Offre terminÃ©e" } },
            "dismissal-date": timestamp,
          },
        },
      },
    }, true);

    if (result.ok || result.stale) {
      const { error: deleteError } = await admin
        .from("live_activity_update_tokens")
        .delete()
        .eq("token", token)
        .eq("user_id", ownerId);
      if (deleteError) throw deleteError;
    }
  }));
}

/** Admin and driver notifications share the existing managed Firebase connector. */
export async function pushUsers(admin, userIds, message) {
  const ids = [...new Set(userIds || [])];
  const key = process.env.LOVABLE_API_KEY, connection = process.env.FIREBASE_MESSAGING_API_KEY;
  if (!ids.length) return false;
  const { data: tokens, error } = await admin.from('push_tokens').select('token').in('user_id', ids);
  if (error || !tokens?.length) return false;
  const headers = key && connection ? { Authorization: `Bearer ${key}`, 'X-Connection-Api-Key': connection, 'Content-Type': 'application/json' } : null;
  const results = await Promise.all(tokens.map(async (row) => ({ token: row.token, ...await sendOne(row.token, message, headers) })));
  const stale = results.filter((row) => row.stale).map((row) => row.token);
  if (stale.length) await admin.from('push_tokens').delete().in('token', stale);
  return results.some((row) => row.ok);
}
