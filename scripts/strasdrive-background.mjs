// Runs independently of any open browser, via GitHub Actions.
// Requires repository secrets SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Never print Uber cookies or Supabase credentials.
import { createClient } from "@supabase/supabase-js";
import { runUberFareCheck } from "../src/lib/vtc-uber-check.server.js";
import { runLearningSample } from "../src/lib/vtc-pricing-learning.server.js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const startedAt = new Date().toISOString();
const status = { startedAt, finishedAt: null, monitor: null, learning: null, source: "github_actions" };
try {
  // force:true checks the live response even if the old hourly toggle is disabled.
  const check = await runUberFareCheck(admin, { force: true });
  status.monitor = { ok: check.ok, checkedAt: check.checkedAt, products: check.products, diagnostic: check.diagnostic, emailAlert: check.emailAlert };
} catch (error) {
  status.monitor = { ok: false, error: String(error?.message || error).slice(0, 200) };
}
try {
  // Respects the existing AI collection toggle and stop conditions.
  const sample = await runLearningSample(admin);
  status.learning = { ok: sample.ok === true, saved: sample.saved || 0, skipped: sample.skipped || null, stopped: sample.stopped || false, reason: sample.reason || null };
} catch (error) {
  status.learning = { ok: false, error: String(error?.message || error).slice(0, 200) };
}
status.finishedAt = new Date().toISOString();
const saved = await admin.from("pricing_rules").upsert({
  vehicle_type: "uber_background_status", is_active: false, rule: status,
}, { onConflict: "vehicle_type" });
if (saved.error) throw saved.error;
console.log(JSON.stringify({ finishedAt: status.finishedAt, monitor: { ok: status.monitor?.ok, products: status.monitor?.products }, learning: status.learning }));
if (status.monitor?.error || status.learning?.error) process.exitCode = 1;
