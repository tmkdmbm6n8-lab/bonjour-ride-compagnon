import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/uber-hourly-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.UBER_CHECK_CRON_SECRET;
        if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const url = new URL(request.url);
          const batch = url.searchParams.get("benchmarkBatch");
          if (batch !== null) {
            const { benchmarkBatch } = await import("@/lib/vtc-uber-benchmark.server");
            const result = await benchmarkBatch(supabaseAdmin, { batch: Number(batch) });
            return Response.json(result, { status: result.ok ? 200 : 503 });
          }
          const { runUberFareCheck } = await import("@/lib/vtc-uber-check.server");
          const result = await runUberFareCheck(supabaseAdmin);
          return Response.json(result);
        } catch (error) {
          console.error("Uber hourly fare check failed", error);
          return Response.json({ ok: false, error: "Check failed" }, { status: 500 });
        }
      },
    },
  },
});
