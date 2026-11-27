import { fareForDriver } from "./driver-ride-fare.server";
import { favoriteDriverId } from "./private-clients.server";
// Sends ride-offer notifications to drivers' phones through Firebase Cloud Messaging (connector gateway).
import { buildOfferMessage, isStaleTokenError, isApnsHexToken, APPLE_BUNDLE_ID } from "./vtc-push";
import {
  buildLiveActivityEnd,
  buildLiveActivityStart,
  liveActivityOfferDriverIds,
  pushDeviceId,
  shouldCloseLiveActivityOffer,
} from "./live-activity-offers";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const SEND_TIMEOUT_MS = 4000;

const diagnostics = [];
export function getPushDiagnostics() { return [...diagnostics]; }
function log(entry) { diagnostics.unshift({ timestamp: new Date().toISOString(), ...entry }); if (diagnostics.length > 150) diagnostics.pop(); }
let jwtCache;

async function sendApple(token, message, options = {}) {
  const { APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY, APNS_ENV } = process.env;
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) { log({provider:"apns",outcome:"missing_configuration"}); return {ok:false}; }
  const liveActivity = options.liveActivity === true;
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
      ? message
      : {...message.data, aps:{alert:message.notification,sound:"default",...message.apns?.payload?.aps}};
    // Cloudflare Workers has no node:http2; its fetch speaks HTTP/2 to APNs.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS);
    let response;
    try {
      const headers = {
        authorization: "bearer " + jwtCache.value,
        "apns-topic": liveActivity ? `${APPLE_BUNDLE_ID}.push-type.liveactivity` : APPLE_BUNDLE_ID,
        "apns-push-type": liveActivity ? "liveactivity" : "alert",
        "apns-priority": "10",
        "apns-expiration": String(options.expiration || message.apns?.headers?.["apns-expiration"] || "0"),
        "content-type": "application/json"
      };
      if (options.collapseId) headers["apns-collapse-id"] = String(options.collapseId).slice(0, 64);
      const res = await fetch("https://" + host + "/3/device/" + token, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      response = { status: res.status, body: await res.text() };
    } finally { clearTimeout(timer); }
    let reason;
    try { reason = JSON.parse(response.body).reason; } catch {}
    const ok = response.status === 200;
    log({provider:"apns",channel:liveActivity?"liveactivity":"alert",environment:APNS_ENV || "production",status:response.status,reason,outcome:ok?"success":"failed"});
    console.info("[APNs]", liveActivity ? "liveactivity" : "alert", response.status, reason || "accepted");
    return {ok,status:response.status,reason,stale:response.status===410};
  } catch(e) { log({provider:"apns",channel:liveActivity?"liveactivity":"alert",outcome:"network_or_configuration_error",code:e?.code || e?.name}); console.error("[APNs] transport error", e?.code || e?.name); return {ok:false}; }
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

/** Remote start for dispatch-authorized drivers; only matched devices replace the classic alert. */
export async function startRideOfferLiveActivities(admin, ride, userIds) {
  const ids = liveActivityOfferDriverIds(ride, userIds);
  if (!ids.length) return { sent: 0, devices: [] };
  const start = buildLiveActivityStart(ride);
  if (!start) return { sent: 0, devices: [] };

  const { data: devices, error } = await admin
    .from("live_activity_start_tokens")
    .select("token,user_id,device_id")
    .in("user_id", ids);
  if (error) throw error;

  const results = await Promise.all((devices ?? []).filter(({ device_id }) => /^[0-9a-f]{64}$/.test(device_id || '')).map(async ({ token, user_id, device_id }) => ({
    token,
    user_id,
    device_id,
    ...await sendApple(token, start.payload, {
      liveActivity: true,
      expiration: start.expiresAt,
      collapseId: start.collapseId,
    }),
  })));
  const expiredTokens = results.filter((result) => result.stale).map(({ token }) => token);
  if (expiredTokens.length) {
    await admin.from("live_activity_start_tokens").delete().in("token", expiredTokens);
  }
  const successful = results.filter((result) => result.ok);
  return { sent: successful.length, devices: successful.map(({ user_id, device_id }) => ({ userId: user_id, deviceId: device_id })) };
}

async function endLiveActivityRows(admin, activities) {
  await Promise.all((activities ?? []).map(async ({ token, user_id: ownerId, ride_id: rideId }) => {
    const end = buildLiveActivityEnd();
    const result = await sendApple(token, end.payload, {
      liveActivity: true,
      expiration: end.expiresAt,
      collapseId: `ride-${rideId}`,
    });
    // A transient Apple/network failure stays in the table for the next expiry run.
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

export async function endRideOfferLiveActivities(admin, rideId, userId, deviceId) {
  let query = admin
    .from("live_activity_update_tokens")
    .select("token,user_id,ride_id")
    .eq("ride_id", String(rideId));
  if (userId !== undefined) query = query.eq("user_id", userId);
  if (deviceId !== undefined) query = query.eq("device_id", deviceId);
  const { data: activities, error } = await query;
  if (error) throw error;
  await endLiveActivityRows(admin, activities);
}

/** Sign-out/account change: only this account on this device, never other phones. */
export async function endDeviceLiveActivities(admin, userId, deviceId) {
  const { data: activities, error } = await admin
    .from("live_activity_update_tokens")
    .select("token,user_id,ride_id")
    .eq("user_id", userId)
    .eq("device_id", deviceId);
  if (error) throw error;
  await endLiveActivityRows(admin, activities);
}

/** Shared by the authenticated WebView fallback and the native background endpoint. */
export async function registerLiveActivityUpdateToken(admin, { userId, deviceId, rideId, activityId, token }) {
  const { error } = await admin.from("live_activity_update_tokens").upsert(
    { token, ride_id: rideId, activity_id: activityId, user_id: userId, device_id: deviceId, updated_at: new Date().toISOString() },
    { onConflict: "user_id,activity_id" },
  );
  if (error) throw error;

  const { data: offer, error: offerError } = await admin
    .from("rides")
    .select("status,offer_expires_at,declined")
    .eq("id", rideId)
    .maybeSingle();
  if (offerError) throw offerError;

  // The activity may have ended before iOS delivered its per-activity token.
  if (shouldCloseLiveActivityOffer(offer, userId)) {
    await endRideOfferLiveActivities(admin, rideId, userId, deviceId);
    return { ok: true, closing: true };
  }
  return { ok: true, closing: false };
}

/** Never throws: a failed notification must not block dispatch. */
export async function pushRideOffer(admin, ride, userIds) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return;
    const lovableKey = process.env.LOVABLE_API_KEY,
      connKey = process.env.FIREBASE_MESSAGING_API_KEY;

    const { data: rows, error } = await admin.from("push_tokens").select("token,user_id").in("user_id", ids);
    const headers = lovableKey && connKey ? {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
      "Content-Type": "application/json",
    } : null;
    const message = buildOfferMessage(ride);
    const favorite = ride.is_test ? null : await favoriteDriverId(admin, ride.rider_id);
    const privateFare = favorite && ids.includes(favorite) ? await fareForDriver(admin, ride, favorite).catch(() => null) : null;
    const privateMessage = privateFare
      ? buildOfferMessage({
          ...ride,
          fare: privateFare,
        })
      : message;
    const starts = await Promise.all(ids.map(async (id) => {
      try {
        return await startRideOfferLiveActivities(admin, id === favorite && privateFare ? { ...ride, fare: privateFare } : ride, [id]);
      } catch (error) {
        console.error("Envoi Live Activity impossible", error?.code || error?.name);
        return { sent: 0, devices: [] };
      }
    }));
    if (error || !rows?.length) return;
    const successfulDevices = starts.flatMap((start) => start.devices);
    const results = await Promise.all(rows.map(async (row) => {
      const deviceId = await pushDeviceId(row.token);
      // Never suppress another phone or Android, nor a rejected Live Activity push.
      if (deviceId && successfulDevices.some((device) => device.userId === row.user_id && device.deviceId === deviceId)) {
        return { token: row.token, ok: true };
      }
      return { ...await sendOne(row.token, row.user_id === favorite ? privateMessage : message, headers), token: row.token };
    }));
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
  if (!ids.length) return false;
  const { data: tokens, error } = await admin.from('push_tokens').select('token').in('user_id', ids);
  if (error || !tokens?.length) return false;
  const headers = key && connection ? { Authorization: `Bearer ${key}`, 'X-Connection-Api-Key': connection, 'Content-Type': 'application/json' } : null;
  const results = await Promise.all(tokens.map(async (row) => ({ token: row.token, ...await sendOne(row.token, message, headers) })));
  const stale = results.filter((row) => row.stale).map((row) => row.token);
  if (stale.length) await admin.from('push_tokens').delete().in('token', stale);
  return results.some((row) => row.ok);
}
