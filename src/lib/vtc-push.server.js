import { fareForDriver } from "./driver-ride-fare.server";
import { favoriteDriverId } from "./private-clients.server";
// Sends ride-offer notifications to drivers' phones through Firebase Cloud Messaging (connector gateway).
import { buildOfferMessage, isStaleTokenError, isApnsHexToken, APPLE_BUNDLE_ID } from "./vtc-push";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const SEND_TIMEOUT_MS = 4000;

const diagnostics = [];
export function getPushDiagnostics() { return [...diagnostics]; }
function log(entry) { diagnostics.unshift({ timestamp: new Date().toISOString(), ...entry }); if (diagnostics.length > 150) diagnostics.pop(); }
let jwtCache;
async function sendApple(token, message) {
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
    const payload = {...message.data, aps:{alert:message.notification,sound:"default",...message.apns?.payload?.aps}};
    const { connect } = await import("node:http2");
    const response = await new Promise((resolve, reject) => {
      const client = connect("https://" + host);
      let timer;
      let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        client.destroy();
        if (error) reject(error); else resolve(result);
      };
      client.on("error", error => finish(error));
      timer = setTimeout(() => finish(new Error("APNs timeout")), SEND_TIMEOUT_MS);
      try {
        const req = client.request({
          ":method": "POST", ":path": "/3/device/" + token,
          authorization: "bearer " + jwtCache.value,
          "apns-topic": APPLE_BUNDLE_ID, "apns-push-type": "alert",
          "apns-priority": "10", "apns-expiration": message.apns?.headers?.["apns-expiration"] || "0",
          "content-type": "application/json"
        });
        let status = 0, body = "";
        req.setEncoding("utf8");
        req.on("response", headers => { status = Number(headers[":status"]); });
        req.on("data", chunk => { body += chunk; });
        req.on("error", error => finish(error));
        req.on("end", () => finish(null, {status, body}));
        req.end(JSON.stringify(payload));
      } catch (error) { finish(error); }
    });
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
  if (!ids.length) return false;
  const { data: tokens, error } = await admin.from('push_tokens').select('token').in('user_id', ids);
  if (error || !tokens?.length) return false;
  const headers = key && connection ? { Authorization: `Bearer ${key}`, 'X-Connection-Api-Key': connection, 'Content-Type': 'application/json' } : null;
  const results = await Promise.all(tokens.map(async (row) => ({ token: row.token, ...await sendOne(row.token, message, headers) })));
  const stale = results.filter((row) => row.stale).map((row) => row.token);
  if (stale.length) await admin.from('push_tokens').delete().in('token', stale);
  return results.some((row) => row.ok);
}
