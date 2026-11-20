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

export async function runUberFareCheck(admin, { force = false } = {}) {
  const rows = await admin.from("pricing_rules").select("vehicle_type,rule").in("vehicle_type", ["uber_cookie", "uber_hourly_checks"]);
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
  const products = await uberProducts(pickup, dropoff, cookie);
  const result = {
    enabled: settings.enabled === true,
    updatedAt: settings.updatedAt || null,
    lastHour: hour,
    lastCheckedAt: new Date().toISOString(),
    lastSuccess: Array.isArray(products) && products.length > 0,
    lastProductCount: products?.length || 0,
  };
  const saved = await admin.from("pricing_rules").upsert({
    vehicle_type: "uber_hourly_checks", is_active: false, rule: result,
  }, { onConflict: "vehicle_type" });
  if (saved.error) throw saved.error;
  return { ok: result.lastSuccess, checkedAt: result.lastCheckedAt, products: result.lastProductCount };
}
