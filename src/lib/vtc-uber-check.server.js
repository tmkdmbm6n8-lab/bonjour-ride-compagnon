// Lightweight fare-availability probe. This never books a ride.
import { uberProducts } from "./vtc-uber.server";

const POINTS = [
  { lat: 48.5734, lng: 7.7521 }, // Strasbourg centre
  { lat: 48.5839, lng: 7.7455 },
  { lat: 48.6107, lng: 7.7520 },
  { lat: 48.5574, lng: 7.7450 },
  { lat: 48.5900, lng: 7.7770 },
  { lat: 48.5450, lng: 7.7350 },
];


// Email once per outage, rearmed by the next valid Uber response.
// Uses the existing verified Resend sender and administrator accounts.
async function notifyUberFailure(admin, checkedAt) {
  if (!process.env.RESEND_API_KEY || !process.env.PAYOUT_NOTIFICATION_FROM) {
    return { sent: false, reason: "Email non configuré (RESEND_API_KEY / PAYOUT_NOTIFICATION_FROM)" };
  }
  const roles = await admin.from("user_roles").select("user_id").eq("role", "admin");
  if (roles.error) throw roles.error;
  const ids = [...new Set((roles.data || []).map(row => row.user_id))];
  const addresses = (await Promise.all(ids.map(async id => {
    const result = await admin.auth.admin.getUserById(id);
    return result.error ? null : result.data.user?.email;
  }))).filter(Boolean);
  if (!addresses.length) return { sent: false, reason: "Aucun e-mail administrateur trouvé" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `uber-signal-${checkedAt}`,
    },
    body: JSON.stringify({
      from: process.env.PAYOUT_NOTIFICATION_FROM,
      to: [...new Set(addresses)],
      subject: "StrasDrive — alerte : aucun prix Uber valide",
      text: `La surveillance de la session Uber n'a obtenu aucun prix valide le ${checkedAt}. Vérifiez le cookie, le réseau et la disponibilité d'Uber dans Administration > Tarification. Cette erreur ne prouve pas à elle seule l'expiration du cookie.`,
    }),
  });
  if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
  return { sent: true };
}

export async function runUberFareCheck(admin, { force = false } = {}) {
  const rows = await admin.from("pricing_rules").select("vehicle_type,rule").in("vehicle_type", ["uber_cookie", "uber_hourly_checks", "uber_signal_alert"]);
  if (rows.error) throw rows.error;
  const settings = rows.data.find((r) => r.vehicle_type === "uber_hourly_checks")?.rule || {};
  if (!force && settings.enabled !== true) return { ok: true, skipped: "disabled" };

  // Avoid overlapping or repeated scheduled checks within the same hour.
  const hour = new Date().toISOString().slice(0, 13);
  if (!force && settings.lastHour === hour) return { ok: true, skipped: "already_checked" };

  const cookie = rows.data.find((r) => r.vehicle_type === "uber_cookie")?.rule?.cookie || null;
  const i = Math.floor(Math.random() * POINTS.length);
  const offset = 1 + Math.floor(Math.random() * (POINTS.length - 1));
  const pickup = POINTS[i];
  const dropoff = POINTS[(i + offset) % POINTS.length];
  const diagnostic = {};
  const products = await uberProducts(pickup, dropoff, cookie, diagnostic);
  const result = {
    enabled: settings.enabled === true,
    updatedAt: settings.updatedAt || null,
    lastHour: hour,
    lastCheckedAt: new Date().toISOString(),
    lastSuccess: Array.isArray(products) && products.length > 0,
    lastProductCount: products?.length || 0,
  };
  // Persist the outage latch across browser refreshes. A successful check rearms it.
  // Only force probes (the 2-second monitor) trigger an immediate alert.
  let alert = { sent: false };
  if (force) {
    const alertRow = rows.data.find(r => r.vehicle_type === "uber_signal_alert")?.rule || {};
    const failed = !result.lastSuccess;
    if (!failed && alertRow.failed) {
      await admin.from("pricing_rules").upsert({
        vehicle_type: "uber_signal_alert", is_active: false,
        rule: { failed: false, updatedAt: result.lastCheckedAt },
      }, { onConflict: "vehicle_type" });
    } else if (failed && !alertRow.failed) {
      // Latch before sending to avoid repeated email attempts every 2 seconds.
      const latch = await admin.from("pricing_rules").upsert({
        vehicle_type: "uber_signal_alert", is_active: false,
        rule: { failed: true, updatedAt: result.lastCheckedAt },
      }, { onConflict: "vehicle_type" });
      if (latch.error) throw latch.error;
      try { alert = await notifyUberFailure(admin, result.lastCheckedAt); }
      catch (error) {
        console.error("[uber-monitor] Email alert failed:", error?.message || error);
        alert = { sent: false, reason: "Envoi e-mail échoué" };
      }
    }
  }
  const saved = await admin.from("pricing_rules").upsert({
    vehicle_type: "uber_hourly_checks", is_active: false, rule: result,
  }, { onConflict: "vehicle_type" });
  if (saved.error) throw saved.error;
  return { ok: result.lastSuccess, checkedAt: result.lastCheckedAt, products: result.lastProductCount, diagnostic, emailAlert: alert };
}
