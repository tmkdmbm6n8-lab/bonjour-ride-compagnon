import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

// Browser-independent Uber session check + one AI learning batch, run by the managed schedule.
export const Route = createFileRoute('/api/public/jobs/uber-background')({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const { supabaseAdmin: admin } = await import('@/integrations/supabase/client.server');
    const { runUberFareCheck } = await import('@/lib/vtc-uber-check.server');
    const { runLearningSample } = await import('@/lib/vtc-pricing-learning.server');
    const status: any = { startedAt: new Date().toISOString(), finishedAt: null, monitor: null, learning: null, source: 'lovable_schedule' };
    try {
      const c: any = await runUberFareCheck(admin, { force: true });
      status.monitor = { ok: c.ok, checkedAt: c.checkedAt, products: c.products, diagnostic: c.diagnostic };
    } catch (e: any) { status.monitor = { ok: false, error: String(e?.message || e).slice(0, 200) }; }
    // Server-side request log (last 500), shown in the admin pricing page.
    try {
      const at = Date.parse(status.startedAt);
      const m = status.monitor || {};
      const entry = { id: at, at, status: m.ok ? 'ok' : 'error', detail: m.ok ? 'Réponse Uber valide' : (m.error || 'Aucun prix Uber valide'), diagnostic: m.diagnostic || null, duration: Date.now() - at, source: 'serveur' };
      const prev: any = await admin.from('pricing_rules').select('rule').eq('vehicle_type', 'uber_check_log').maybeSingle();
      const entries = Array.isArray(prev.data?.rule?.entries) ? prev.data.rule.entries : [];
      await admin.from('pricing_rules').upsert({ vehicle_type: 'uber_check_log', is_active: false, rule: { entries: [entry, ...entries].slice(0, 500) } }, { onConflict: 'vehicle_type' });
    } catch (e: any) { console.error('[uber-background] log failed', e?.message || e); }
    try {
      const s: any = await runLearningSample(admin);
      status.learning = { ok: s.ok === true, saved: s.saved || 0, skipped: s.skipped || null, stopped: s.stopped || false, reason: s.reason || null };
    } catch (e: any) { status.learning = { ok: false, error: String(e?.message || e).slice(0, 200) }; }
    status.finishedAt = new Date().toISOString();
    await admin.from('pricing_rules').upsert({ vehicle_type: 'uber_background_status', is_active: false, rule: status }, { onConflict: 'vehicle_type' });
    return Response.json({ ok: true, monitor: status.monitor?.ok, learning: status.learning?.ok });
  } } },
});
