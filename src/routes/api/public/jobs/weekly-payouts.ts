import { createFileRoute } from '@tanstack/react-router'
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth'

// Weekly driver transfers, Monday 00:00 Paris time. The schedule fires Sunday 22:00 and 23:00 UTC
// (covering summer and winter time); only the run that lands in Paris' Monday midnight hour pays.
export const Route = createFileRoute('/api/public/jobs/weekly-payouts')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request)
        if (authFailure) return authFailure

        const { isPayoutWindow } = await import('@/lib/vtc-payouts')
        const now = new Date()
        if (!isPayoutWindow(now)) return Response.json({ skipped: 'outside_paris_monday_midnight' })

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { runWeeklyPayouts } = await import('@/lib/vtc-payments.server')
        const result = await runWeeklyPayouts(supabaseAdmin, now)
        return Response.json(result)
      },
    },
  },
})
